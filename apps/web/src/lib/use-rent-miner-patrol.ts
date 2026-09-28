"use client";

import { useEffect, useRef, useState } from "react";
import {
  isClimb,
  minerIdlePose,
  minerPose,
  planPatrolStep,
  poseKind,
  remapStationIndex,
  RENT_IDLE_STATION,
  type CrateStation,
  type PatrolCursor,
  type PatrolDir,
  type PatrolStep,
} from "@/lib/rent-miner-patrol";

type Engine = PatrolCursor & {
  timer: number | null;
  addrs: string[];
};

const idle: Engine = {
  i: 0,
  dir: 1,
  phase: "on",
  prevT: 0,
  prevY: 0,
  timer: null,
  addrs: [],
};

export function useRentMinerPatrol(
  stations: CrateStation[],
  hotAddr: string | null,
  reduce: boolean | null
) {
  const freeze = reduce !== false;
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const hotRef = useRef(hotAddr);
  hotRef.current = hotAddr;
  const prevHot = useRef(hotAddr);
  const booted = useRef(false);
  const hadN = useRef(0);
  const eng = useRef<Engine>({ ...idle });

  const [pose, setPose] = useState(() => minerIdlePose());
  const [walking, setWalking] = useState(false);
  const [swinging, setSwinging] = useState(false);
  const [walkMs, setWalkMs] = useState(400);
  const [facing, setFacing] = useState<PatrolDir>(1);
  const [onAddrs, setOnAddrs] = useState<string[]>([]);
  const [climbing, setClimbing] = useState(false);

  const stopTimer = () => {
    if (eng.current.timer != null) {
      window.clearTimeout(eng.current.timer);
      eng.current.timer = null;
    }
  };

  const park = (st: CrateStation) => {
    stopTimer();
    eng.current = {
      i: 0,
      dir: 1,
      phase: "on",
      prevT: st.t,
      prevY: st.y,
      timer: null,
      addrs: st.addresses,
    };
    setPose(st.addresses.length ? minerPose("on", st) : minerIdlePose());
    setWalking(false);
    setSwinging(false);
    setClimbing(false);
    setFacing(1);
    setWalkMs(0);
    setOnAddrs(st.addresses);
  };

  const applyStep = (step: PatrolStep, live: readonly CrateStation[]) => {
    const st = live[step.i];
    if (!st) return;
    const fromT = eng.current.prevT;
    const fromY = eng.current.prevY;
    const face: PatrolDir =
      Math.abs(st.t - fromT) < 0.03 ? (st.t >= 0.5 ? -1 : 1) : st.t >= fromT ? 1 : -1;
    eng.current.i = step.i;
    eng.current.dir = step.dir;
    eng.current.phase = step.phase;
    eng.current.prevT = step.prevT;
    eng.current.prevY = step.prevY;
    eng.current.addrs = st.addresses;
    setPose(minerPose(poseKind(face, step.phase), st));
    setFacing(face);
    setWalkMs(step.ms);
    setWalking(step.gait === "walk");
    setSwinging(step.gait === "swing");
    setClimbing(step.gait === "walk" && isClimb(fromY, st.y));
    setOnAddrs(step.phase === "on" ? st.addresses : []);
  };

  const runRef = useRef<() => void>(() => {});
  runRef.current = () => {
    if (freeze) return;
    const live = stationsRef.current;
    stopTimer();
    if (!live.length) {
      park(RENT_IDLE_STATION);
      return;
    }
    const p = eng.current;
    p.i = remapStationIndex(live, p.addrs, p.i);
    const step = planPatrolStep(live, p, hotRef.current);
    if (!step) {
      park(live[0] ?? RENT_IDLE_STATION);
      return;
    }
    applyStep(step, live);
    eng.current.timer = window.setTimeout(() => {
      const next = stationsRef.current;
      eng.current.i = step.after.i;
      eng.current.dir = step.after.dir;
      eng.current.phase = step.after.phase;
      eng.current.prevT = step.after.prevT;
      eng.current.prevY = step.after.prevY;
      const st = next[step.after.i];
      eng.current.addrs = st?.addresses ?? [];
      runRef.current();
    }, step.ms);
  };

  useEffect(() => {
    if (freeze) {
      booted.current = false;
      park(stationsRef.current[0] ?? RENT_IDLE_STATION);
      return;
    }
    const id = window.setTimeout(() => {
      booted.current = true;
      hadN.current = stationsRef.current.length;
      runRef.current();
    }, 40);
    return () => {
      booted.current = false;
      window.clearTimeout(id);
      stopTimer();
    };
    // freeze is the only restart; station changes remap inside run().
    // eslint-disable-next-line react-hooks/exhaustive-deps -- park/stopTimer close over setState
  }, [freeze]);

  useEffect(() => {
    const n = stations.length;
    if (freeze || !booted.current) {
      hadN.current = n;
      return;
    }
    if (n === 0) {
      if (hadN.current > 0) park(RENT_IDLE_STATION);
      hadN.current = 0;
      return;
    }
    if (hadN.current === 0) runRef.current();
    hadN.current = n;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kick empty↔shelf only
  }, [stations.length, freeze]);

  useEffect(() => {
    if (freeze) return;
    if (prevHot.current === hotAddr) return;
    prevHot.current = hotAddr;
    if (hotAddr == null) return;
    runRef.current();
  }, [hotAddr, freeze]);

  return {
    pose,
    walking,
    swinging,
    walkMs,
    facing,
    onAddrs,
    climbing,
    freeze,
  };
}
