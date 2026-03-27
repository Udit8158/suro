type LoggerInput = {
  event: string; // like a shot dev msg
  method: string; // req method
  path: string;
  cacheUsed: boolean;
  latencyInMs: number; // ms
  dbUsed: boolean;
  statusCode: number; // user got valide data 200,300 etc
};

// export const logger = (arg: LoggerInput) => {
//   // console.log(
//   //   `
//   //     URL path - ${arg.path}
//   //     Cache used - ${arg.cacheUsed}
//   //     Latency of the request - ${arg.latency} ms
//   //     DB hit - ${arg.dbUsed}
//   //     Request succeded - ${arg.success}
//   //   `,
//   // );
//   console.log({ ...arg });
// };

export const logger = {
  info: (data: LoggerInput) => console.log({ ...data }),
  error: (data: LoggerInput, err: unknown) => console.error({ ...data }, err),
};
