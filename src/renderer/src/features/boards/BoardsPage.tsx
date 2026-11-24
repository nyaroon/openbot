import { BOARDS_CAPABILITY } from "@openbot/contracts/team-protocol/boards-v1";
import { createMemo, Show } from "solid-js";
import { useNavigation } from "../../navigation";
import { useAgents } from "../agents/agents-context";
import { serverCanAdminister, serverSupportsCapability } from "../servers/server-capabilities";
import { useServers } from "../servers/servers-context";
import { usePresence } from "../team/team-context";
import { BoardsScreen } from "./BoardsScreen";
import { desktopBoardsHost } from "./boards-port";

export function BoardsPage(props: { serverId: string }) {
  const { servers } = useServers();
  const { agentList } = useAgents();
  const { teamPresence, currentTeamMember } = usePresence();
  const navigation = useNavigation();
  const server = () => servers().find((candidate) => candidate.id === props.serverId);
  const members = createMemo(() =>
    teamPresence()
      .members.filter((member) => !member.disabled)
      .map((member) => ({ id: member.id, name: member.name?.trim() || member.username })),
  );
  const agents = createMemo(() => agentList().map((agent) => ({ id: agent.id, name: agent.name })));
  return (
    <Show when={serverSupportsCapability(server(), BOARDS_CAPABILITY) ? props.serverId : null} keyed>
      {(serverId) => (
        <BoardsScreen
          serverId={serverId}
          host={desktopBoardsHost(serverId)}
          members={members()}
          agents={agents()}
          currentMemberId={currentTeamMember()?.id ?? null}
          canDelete={serverCanAdminister(server())}
          openThread={(link) => navigation.selectAgent(link.agentId, link.threadId)}
        />
      )}
    </Show>
  );
}
