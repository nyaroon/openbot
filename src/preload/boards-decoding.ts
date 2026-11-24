import { isBoardArchivedCards, isBoardDetail, isBoardList, isBoardMutation } from "@openbot/contracts/ipc";
import { guardedDecoder } from "@openbot/contracts/ipc-decoding";

export const decodeBoardList = guardedDecoder(isBoardList, "board list response");
export const decodeBoardDetail = guardedDecoder(isBoardDetail, "board response");
export const decodeBoardArchivedCards = guardedDecoder(isBoardArchivedCards, "archived board cards response");
export const decodeBoardMutation = guardedDecoder(isBoardMutation, "board change response");
