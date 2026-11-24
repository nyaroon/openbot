import { type BoardIdInput, type BoardsChange, isBoardIdInput, isBoardsChange } from "@openbot/contracts/ipc";

export function parseBoardIdInput(value: unknown): BoardIdInput {
  if (!isBoardIdInput(value)) throw new Error("Invalid board request.");
  return value;
}

export function parseBoardsChange(value: unknown): BoardsChange {
  if (!isBoardsChange(value)) throw new Error("Invalid board change.");
  return value;
}
