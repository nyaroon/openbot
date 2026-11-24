import type { BoardThreadLink } from "@openbot/contracts/ipc";
import { BoardsView } from "@openbot/ui/features/boards/BoardsView";
import type { BoardsAgent, BoardsMember, BoardsThread } from "@openbot/ui/features/boards/boards-model";
import { useText } from "@openbot/ui/text";
import { createBoardsController } from "./boards-controller";
import type { BoardsHost } from "./boards-port";

const MAIN_THREAD_ID = "main";

export function BoardsScreen(props: {
  serverId: string;
  host: BoardsHost;
  members: readonly BoardsMember[];
  agents: readonly BoardsAgent[];
  currentMemberId: string | null;
  canDelete: boolean;
  openThread: (link: BoardThreadLink) => void;
}) {
  const { t } = useText();
  const boards = createBoardsController(props.host, props.serverId);
  async function threads(agentId: string): Promise<BoardsThread[]> {
    const main: BoardsThread = { id: MAIN_THREAD_ID, title: t("chat.pins.mainChat") };
    try {
      return [main, ...(await props.host.threads(agentId))];
    } catch {
      return [main];
    }
  }
  return (
    <div class="boards-window-page">
      <BoardsView
        load={boards.load}
        boards={boards.boards}
        selectedId={boards.selectedId}
        detail={boards.detail}
        detailLoad={boards.detailLoad}
        members={props.members}
        agents={props.agents}
        currentMemberId={props.currentMemberId}
        canDelete={props.canDelete}
        onSelect={boards.onSelect}
        onRetry={boards.onRetry}
        apply={boards.apply}
        moveCard={boards.moveCard}
        archivedCards={boards.archivedCards}
        threads={threads}
        openThread={props.openThread}
        hold={boards.hold}
      />
    </div>
  );
}
