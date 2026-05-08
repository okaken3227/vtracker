import { describe, it, expect } from "vitest";
import { parseChannelUrl } from "../lib/crawler/urlParser";

describe("parseChannelUrl", () => {
  it("channel ID の直接入力", () => {
    expect(parseChannelUrl("UCxxxxxxxxxxxxxxxxxxxxxx")).toEqual({
      type: "id",
      value: "UCxxxxxxxxxxxxxxxxxxxxxx",
    });
  });

  it("@handle の直接入力", () => {
    expect(parseChannelUrl("@minamina")).toEqual({
      type: "handle",
      value: "minamina",
    });
  });

  it("/channel/UCxxxx 形式の URL", () => {
    expect(
      parseChannelUrl("https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx"),
    ).toEqual({ type: "id", value: "UCxxxxxxxxxxxxxxxxxxxxxx" });
  });

  it("/@handle 形式の URL", () => {
    expect(
      parseChannelUrl("https://www.youtube.com/@minamina"),
    ).toEqual({ type: "handle", value: "minamina" });
  });

  it("/c/customUrl 形式の URL", () => {
    expect(
      parseChannelUrl("https://www.youtube.com/c/minamina"),
    ).toEqual({ type: "handle", value: "minamina" });
  });

  it("/user/username 形式の URL（旧形式）", () => {
    expect(
      parseChannelUrl("https://www.youtube.com/user/minamina"),
    ).toEqual({ type: "handle", value: "minamina" });
  });

  it("不正な URL は null", () => {
    expect(parseChannelUrl("not-a-url")).toBeNull();
  });

  it("YouTube 以外のドメインは null", () => {
    expect(parseChannelUrl("https://twitter.com/@someone")).toBeNull();
  });

  it("空文字列は null", () => {
    expect(parseChannelUrl("")).toBeNull();
  });
});
