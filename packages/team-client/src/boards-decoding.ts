import { isBoardArchivedCards, isBoardDetail, isBoardList, isBoardMutation } from "@openbot/contracts/ipc";
import { guardedDecoder } from "@openbot/contracts/ipc-decoding";

export const decodeRemoteBoardList = guardedDecoder(isBoardList, "remote board list");
export const decodeRemoteBoardDetail = guardedDecoder(isBoardDetail, "remote board");
export const decodeRemoteBoardArchivedCards = guardedDecoder(isBoardArchivedCards, "remote archived board cards");
export const decodeRemoteBoardMutation = guardedDecoder(isBoardMutation, "remote board change result");
