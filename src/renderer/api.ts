import type { ApiResult, ErrorCode } from "@shared/ipc/common";
import type { ChannelName, IpcChannels } from "@shared/ipc";

/** Thrown by `call` whenever the main process answers with an error result. */
export class ApiCallError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiCallError";
    this.code = code;
    this.fields = fields;
  }
}

/**
 * Sends a request to the main process and unwraps the result. On success it
 * returns the data; on failure it throws an `ApiCallError`.
 */
export async function call<C extends ChannelName>(
  channel: C,
  payload: IpcChannels[C]["in"],
): Promise<IpcChannels[C]["out"]> {
  const result = (await window.api.invoke(channel, payload)) as ApiResult<IpcChannels[C]["out"]>;
  if (!result.ok) {
    throw new ApiCallError(result.error.code, result.error.message, result.error.fields);
  }
  return result.data;
}
