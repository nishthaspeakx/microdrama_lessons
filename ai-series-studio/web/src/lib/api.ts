import { NextResponse } from "next/server";
export const UUID = /^[0-9a-f-]{36}$/i;
export const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
export async function guard<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    return bad((e as Error).message, 409);
  }
}
