import React, { useState } from "react";
import { Box, Group, Button, Center, Text } from "@mantine/core";
import CoderPOV from "@/components/coderPOV";
import TesterPOV from "@/components/testerPOV";
import { Socket } from "socket.io-client";
import { GameStatus } from "@prisma/client";
import { TeamCount } from "@/components/TeamSelect";
import { Message } from "@/components/ChatBox"

interface SpectatorPOVProps {
  socket: Socket;
  teams: TeamCount[];
  userId: string;
  liveCode: string;
  setLiveCode: React.Dispatch<React.SetStateAction<string>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  testCases: { id: string; content: string}[];
  setTestCases: React.Dispatch<React.SetStateAction<{ id: string; content: string}[]>>;
  endTimeRef: number;
  duration: number;
  gameState: GameStatus;
}

export default function SpectatorPOV({ socket, teams, userId, liveCode, setLiveCode, messages, setMessages, testCases, setTestCases, endTimeRef, duration, gameState }: SpectatorPOVProps) {
  const [view, setView] = useState<'none' | 'coder' | 'tester'>('none');
  const [viewTeamId, setViewTeamId] = useState<string>("");

  return (
    //The exit view button is temporary for testing purposes.
    <Box style={{ position: 'relative', height: '100vh' }}>
      <Box style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
        {teams.map((team, i) => (
          <Group key={team.teamId} gap="xs">
            <Button data-testid={`team-${i+1}-coder`} size="sm" onClick={() => { setView('coder'); setViewTeamId(team.teamId); }}>
              Team {i + 1} Coder
            </Button>
            <Button data-testid={`team-${i+1}-tester`} size="sm" onClick={() => { setView('tester'); setViewTeamId(team.teamId); }}>
              Team {i + 1} Tester
            </Button>
          </Group>
        ))}
        <Button data-testid="exit-spectator" size="sm" onClick={() => setView('none')}>Exit View</Button>
      </Box>

      {view === 'none' && (
        <Center h="100vh">
          <Text data-testid="spectating-words" size="xl" c="dimmed">The room is full. You are spectating.</Text>
        </Center>
      )}

      {view === 'coder' && (
        <Box style={{ height: '100%' }}>
          <CoderPOV socket={socket} roomId={viewTeamId} isSpectator={true} userId={userId}  liveCode={liveCode} setLiveCode={setLiveCode} messages={messages} setMessages={setMessages} endTimeRef={endTimeRef} duration={duration} gameState={gameState} />
        </Box>
      )}

      {view === 'tester' && (
        <Box style={{ height: '100%' }}>
          <TesterPOV socket={socket} roomId={viewTeamId} isSpectator={true} userId={userId} liveCode={liveCode} setLiveCode={setLiveCode} messages={messages} setMessages={setMessages} testCases={testCases} setTestCases={setTestCases} endTimeRef={endTimeRef} duration={duration} gameState={gameState} />
        </Box>
      )}
    </Box>
  );
}