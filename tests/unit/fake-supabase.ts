/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal fake of the Supabase chained query builder — enough for the money
// paths under test. Every builder method returns the same stub (so `.from().
// select().eq()...` chains), the stub is thenable, and `.maybeSingle()/.single()`
// also resolve. What a chain resolves to is decided by the test-supplied
// `resolve({ table, op, filters, payload })`. Every insert/update is recorded in
// `.calls` for assertions. No network, no creds.

export type ResolveCtx = {
  table: string
  op: "select" | "insert" | "update" | "delete" | "upsert" | "rpc"
  filters: [string, any][] // every .eq(col,val) seen on this chain
  payload: any // rows for insert, values for update
}
export type Result = { data?: any; error?: any }
export type FakeCall =
  | { table: string; op: "insert"; rows: any }
  | { table: string; op: "upsert"; rows: any; opts: any }
  | { table: string; op: "update"; vals: any; filters: [string, any][] }
  | { table: string; op: "delete"; filters: [string, any][] }
  | { table: string; op: "rpc"; args: any }

export function makeFakeClient(
  resolve: (ctx: ResolveCtx) => Result,
  userId: string | null = "u1",
  email?: string
) {
  const calls: FakeCall[] = []

  function from(table: string) {
    const state = {
      op: "select" as ResolveCtx["op"],
      payload: undefined as any,
      filters: [] as [string, any][],
    }
    const settle = () =>
      Promise.resolve(
        resolve({ table, op: state.op, filters: state.filters, payload: state.payload })
      )
    const stub: any = {
      select: () => stub,
      eq: (col: string, val: any) => {
        state.filters.push([col, val])
        return stub
      },
      // .in("id", [a,b]) — recorded as ["in.id", [a,b]]
      in: (col: string, vals: any) => {
        state.filters.push([`in.${col}`, vals])
        return stub
      },
      // .is/.lt/.lte recorded as ["is.col", v], ["lt.col", v], ["lte.col", v]
      is: (col: string, val: any) => {
        state.filters.push([`is.${col}`, val])
        return stub
      },
      lte: (col: string, val: any) => {
        state.filters.push([`lte.${col}`, val])
        return stub
      },
      // .not("id", "in", "(a,b)") — recorded as ["not.id", "(a,b)"]
      not: (col: string, _op: string, val: any) => {
        state.filters.push([`not.${col}`, val])
        return stub
      },
      neq: () => stub,
      contains: (col: string, val: any) => {
        state.filters.push([`contains.${col}`, val])
        return stub
      },
      lt: (col: string, val: any) => {
        state.filters.push([`lt.${col}`, val])
        return stub
      },
      gt: () => stub,
      gte: () => stub,
      or: () => stub,
      order: () => stub,
      limit: () => stub,
      range: () => stub,
      insert: (rows: any) => {
        state.op = "insert"
        state.payload = rows
        calls.push({ table, op: "insert", rows })
        return stub
      },
      upsert: (rows: any, opts: any) => {
        state.op = "upsert"
        state.payload = rows
        calls.push({ table, op: "upsert", rows, opts })
        return stub
      },
      update: (vals: any) => {
        state.op = "update"
        state.payload = vals
        return stub
      },
      delete: () => {
        state.op = "delete"
        return stub
      },
      maybeSingle: () => settle(),
      single: () => settle(),
      // update captures filters lazily (they arrive after .update via .eq), so
      // record the call at terminal time when they're known.
      then: (onF: any, onR: any) => {
        if (state.op === "update")
          calls.push({ table, op: "update", vals: state.payload, filters: state.filters })
        else if (state.op === "delete")
          calls.push({ table, op: "delete", filters: state.filters })
        return settle().then(onF, onR)
      },
    }
    // update chains that end in maybeSingle/single also need the call recorded.
    const origMaybe = stub.maybeSingle
    stub.maybeSingle = () => {
      if (state.op === "update")
        calls.push({ table, op: "update", vals: state.payload, filters: state.filters })
      return origMaybe()
    }
    return stub
  }

  return {
    from,
    // rpc(fn, args) resolves via resolve({ table: fn, op: "rpc", payload: args });
    // a resolve that returns undefined falls back to { error: null }.
    // Awaitable directly or via .single()/.maybeSingle() (which, like
    // PostgREST, take the first row of an array result).
    rpc: (fn: string, args?: any) => {
      calls.push({ table: fn, op: "rpc", args })
      const result = Promise.resolve(resolve({ table: fn, op: "rpc", filters: [], payload: args }) ?? { error: null })
      const one = () => result.then((r: any) => (Array.isArray(r?.data) ? { ...r, data: r.data[0] ?? null } : r))
      return Object.assign(result, { single: one, maybeSingle: one })
    },
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId, email } : null } }) },
    calls,
  }
}
