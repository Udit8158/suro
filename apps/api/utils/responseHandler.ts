import { Response } from "express";

// response structuring
type APIResponse<TData> = {
  statusCode: number;
  success: boolean;
  error: string | null;
  data: TData | null;
  res: Response;
  errorDetails?: unknown;
};

export function responseHandler<TData>({
  statusCode,
  success,
  error,
  data,
  res,
  errorDetails,
}: APIResponse<TData>) {
  return res.status(statusCode).json({
    success,
    error,
    data,
    errorDetails,
  });
}
