import { pack, Packr } from 'msgpackr';
import { encode, Iterator } from '@colyseus/schema';

// Colyseus protocol codes range between 0~100
export enum Protocol {
  // Room-related (10~19)
  JOIN_ROOM = 10,
  ERROR = 11,
  LEAVE_ROOM = 12,
  ROOM_DATA = 13,
  ROOM_STATE = 14,
  ROOM_STATE_PATCH = 15,
  // ROOM_DATA_SCHEMA = 16, // DEPRECATED: used to send schema instances via room.send()
  ROOM_DATA_BYTES = 17,

  // WebSocket close codes (https://github.com/Luka967/websocket-close-codes)
  WS_CLOSE_NORMAL = 1000,
  WS_CLOSE_GOING_AWAY = 1001,

  // WebSocket error codes
  WS_CLOSE_CONSENTED = 4000,
  WS_CLOSE_WITH_ERROR = 4002,
  WS_CLOSE_DEVMODE_RESTART = 4010,

  WS_SERVER_DISCONNECT = 4201,
  WS_TOO_MANY_CLIENTS = 4202,
}

export enum ErrorCode {
  // MatchMaking Error Codes
  MATCHMAKE_NO_HANDLER = 4210,
  MATCHMAKE_INVALID_CRITERIA = 4211,
  MATCHMAKE_INVALID_ROOM_ID = 4212,
  MATCHMAKE_UNHANDLED = 4213, // generic exception during onCreate/onJoin
  MATCHMAKE_EXPIRED = 4214, // generic exception during onCreate/onJoin

  AUTH_FAILED = 4215,
  APPLICATION_ERROR = 4216,

  INVALID_PAYLOAD = 4217,
}

// Inter-process communication protocol
export enum IpcProtocol {
  SUCCESS = 0,
  ERROR = 1,
  TIMEOUT = 2,
}

const sendBuffer = Buffer.allocUnsafe(8192);
const packr = new Packr();
// @ts-ignore
packr.useBuffer(sendBuffer);

export const getMessageBytes = {
  [Protocol.JOIN_ROOM]: (reconnectionToken: string, serializerId: string, handshake?: Buffer) => {
    const it: Iterator = { offset: 1 };
    sendBuffer[0] = Protocol.JOIN_ROOM;

    sendBuffer[it.offset++] = Buffer.byteLength(reconnectionToken, "utf8");
    encode.utf8Write(sendBuffer, reconnectionToken, it);

    sendBuffer[it.offset++] = Buffer.byteLength(serializerId, "utf8");
    encode.utf8Write(sendBuffer, serializerId, it);

    handshake.copy(sendBuffer, it.offset, 0, handshake.byteLength);
    return sendBuffer.subarray(0, it.offset + handshake.byteLength);
  },

  [Protocol.ERROR]: (code: number, message: string = '') => {
    const it: Iterator = { offset: 1 };
    sendBuffer[0] = Protocol.ERROR;

    encode.number(sendBuffer, code, it);
    encode.string(sendBuffer, message, it);

    return sendBuffer.subarray(0, it.offset);
  },

  [Protocol.ROOM_STATE]: (bytes: number[]) => {
    return [Protocol.ROOM_STATE, ...bytes];
  },

  raw: (code: Protocol, type: string | number, message?: any, rawMessage?: Uint8Array | Buffer) => {
    const it: Iterator = { offset: 1 };
    sendBuffer[0] = code;

    if (typeof (type) === 'string') {
      encode.string(sendBuffer, type as string, it);

    } else {
      encode.number(sendBuffer, type, it);
    }

    if (message !== undefined) {
      // pack message into sendBuffer
      // @ts-ignore
      const msgpackedLength = pack(message, 2048 + it.offset).byteLength; // PR to fix TypeScript types https://github.com/kriszyp/msgpackr/pull/137
                                         // 2048 = RESERVE_START_SPACE
      return sendBuffer.subarray(0, it.offset + msgpackedLength);

    } else if (rawMessage !== undefined) {

      // copy raw message into sendBuffer
      sendBuffer.set(rawMessage, it.offset);
      return sendBuffer.subarray(0, it.offset + rawMessage.byteLength);

    } else {
      return sendBuffer.subarray(0, it.offset);
    }
  },

};

