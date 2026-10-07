import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowStreamOrigin,
  isApiContour,
  isSitePageOrigin,
  siteCorsReflect,
} from "./siteOrigin.js";

test("site pages are the two https names only", () => {
  assert.equal(isSitePageOrigin("https://ergoscan.me"), true);
  assert.equal(isSitePageOrigin("https://www.ergoscan.me"), true);
  assert.equal(isSitePageOrigin("https://ergoscan.me/"), false);
  assert.equal(isSitePageOrigin("http://ergoscan.me"), false);
  assert.equal(isSitePageOrigin("https://ergoscan.me.evil.example"), false);
  assert.equal(isSitePageOrigin("https://api.ergoscan.me"), false);
  assert.equal(isSitePageOrigin("null"), false);
  assert.equal(isSitePageOrigin(""), false);
  assert.equal(isSitePageOrigin(undefined), false);
});

test("site CORS reflects only those names", () => {
  assert.equal(siteCorsReflect("https://ergoscan.me"), "https://ergoscan.me");
  assert.equal(siteCorsReflect("https://www.ergoscan.me"), "https://www.ergoscan.me");
  assert.equal(siteCorsReflect(undefined), false);
  assert.equal(siteCorsReflect("https://evil.example"), false);
});

test("api contour is only the string 1", () => {
  const prev = process.env.API_CONTOUR;
  try {
    delete process.env.API_CONTOUR;
    assert.equal(isApiContour(), false);
    process.env.API_CONTOUR = "1";
    assert.equal(isApiContour(), true);
    process.env.API_CONTOUR = "true";
    assert.equal(isApiContour(), false);
  } finally {
    if (prev === undefined) delete process.env.API_CONTOUR;
    else process.env.API_CONTOUR = prev;
  }
});

test("stream allows the site names and, on the api process, anyone", () => {
  const prev = process.env.API_CONTOUR;
  try {
    delete process.env.API_CONTOUR;
    assert.equal(allowStreamOrigin("https://ergoscan.me", false), true);
    assert.equal(allowStreamOrigin("https://www.ergoscan.me", false), true);
    assert.equal(allowStreamOrigin("https://evil.example", false), false);
    assert.equal(allowStreamOrigin(undefined, true), true);
    assert.equal(allowStreamOrigin(undefined, false), false);
    process.env.API_CONTOUR = "1";
    assert.equal(allowStreamOrigin("https://evil.example", false), true);
    assert.equal(allowStreamOrigin(undefined, false), true);
  } finally {
    if (prev === undefined) delete process.env.API_CONTOUR;
    else process.env.API_CONTOUR = prev;
  }
});
