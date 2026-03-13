export default function extractTargetFields(e: Error) {
  // @ts-ignore
  return e.meta?.driverAdapterError?.cause?.constraint?.fields.map(
    (f: string) => f.replace(/"/g, ""),
  ) as string[];
}
