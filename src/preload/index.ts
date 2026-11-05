import { contextBridge, ipcRenderer } from "electron";
import type { ChannelName, IpcChannels } from "@shared/ipc";
import type { ApiResult } from "@shared/ipc/common";

export interface StockBillApi {
  invoke<C extends ChannelName>(
    channel: C,
    payload: IpcChannels[C]["in"],
  ): Promise<ApiResult<IpcChannels[C]["out"]>>;
}

const api: StockBillApi = {
  invoke<C extends ChannelName>(channel: C, payload: IpcChannels[C]["in"]) {
    return ipcRenderer.invoke(channel, payload) as Promise<ApiResult<IpcChannels[C]["out"]>>;
  },
};

contextBridge.exposeInMainWorld("api", api);
