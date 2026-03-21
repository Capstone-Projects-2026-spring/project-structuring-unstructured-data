import React, { useEffect, useState } from "react";
import { Box, Group, Button, Select, Text, Tabs } from "@mantine/core";
import Editor from "@monaco-editor/react";
import Navbar from "@/components/Navbar";
import ProblemBox from "@/components/ProblemBox";
import ChatBox from "@/components/ChatBox";
import GameTimer from "@/components/GameTimer";
import RoleFlipPopup from "@/components/RoleFlipPopup"
import { Socket } from "socket.io-client";
import { GameStatus } from "@prisma/client";
import { Message } from "@/components/ChatBox"


interface TesterPOVProps {
  socket: Socket;
  roomId: string;
  userId: string;
  liveCode: string;
  setLiveCode: React.Dispatch<React.SetStateAction<string>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  testCases: { id: string; content: string }[];
  setTestCases: React.Dispatch<React.SetStateAction<{id: string; content: string}[]>>;
  endTimeRef: number;
  duration: number;
  gameState: GameStatus;
  isSpectator?: boolean;
}

export default function TesterPOV({
  socket,
  roomId,
  userId,
  liveCode,
  setLiveCode,
  messages,
  setMessages,
  testCases,
  setTestCases,
  endTimeRef,
  duration,
  gameState,
  isSpectator = false,
}: TesterPOVProps) {
  const [activeTab, setActiveTab] = useState<string | null>("1");

  useEffect(() => {
    socket.emit('requestCodeSync', { teamId: roomId });
    socket.emit('requestTestCaseSync', { teamId: roomId });
    
    socket.on('receiveTestCaseSync', (cases) => {
      setTestCases(cases);
    })

    socket.on("receiveCodeUpdate", (newCode: string) => {
        setLiveCode(newCode);
    });

    const handler = (newCode: string) => setLiveCode(newCode);
    socket.on("receiveCodeUpdate", handler);
    return () => { socket.off("receiveCodeUpdate", handler); socket.off("recieveCodeUpdate") }; // Need to clean up leaked socket stuff
  }, [socket, roomId]);

  const addNewTest = () => {
    if (testCases.length < 5) {
      const newId = (testCases.length + 1).toString();
      setTestCases([...testCases, { id: newId, content: `// Write Test ${newId} here...` }]);
      setActiveTab(newId);
    }
  };

  const handleTestCaseChange = (id: string, value: string | undefined) => {
    if (isSpectator || value === undefined) return;
    const updated = testCases.map(test => test.id === id ? { ...test, content: value } : test); 
    setTestCases(updated);
    socket.emit('updateTestCases', { teamId: roomId, testCases: updated });
  }

  return (
    <Box data-testid="tester-pov" h="100vh" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <RoleFlipPopup gameState={gameState} /> 
      <Navbar
        links={["Timer", "Players", "Tournament"]}
        title="CODE BATTLEGROUNDS | GAMEMODE: TIMER"
        isSpectator={isSpectator}
      />

      <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Sidebar */}
        <Box 
          style={{ 
            width: "25%", 
            minWidth: "250px", 
            maxWidth: "400px",
            backgroundColor: "#333", 
            color: "white", 
            padding: "1rem", 
            overflowY: "auto",
            flexShrink: 0 
          }}
        >
          {(gameState === GameStatus.ACTIVE || gameState === GameStatus.FLIPPING) && (
            <Box mb="md">
              <GameTimer endTime={endTimeRef} duration={duration} />
            </Box>
          )}
          <ProblemBox />
        </Box>

        {/* Workspace */}
        <Box style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Group p="xs" bg="#f8f9fa" style={{ borderBottom: "1px solid #ddd", flexShrink: 0 }}>
            <Select size="xs" data={["Javascript"]} defaultValue="Javascript" disabled style={{ width: 120 }} />
            <Text size="xs" c="dimmed">|</Text>
            <Button size="xs" color="cyan" disabled={isSpectator}>RUN ▷</Button>
            <Button size="xs" variant="subtle" color="gray" disabled={isSpectator}>Submit</Button>
          </Group>

          {/* Middle Row: Code Watcher & Chat */}
          <Box style={{ display: "flex", flex: "1 1 45%", borderBottom: "2px solid #333", minHeight: 0 }}>
            <Box style={{ flex: 1, borderRight: "1px solid #ddd", minWidth: 0 }}>
              <Editor
                height="100%"
                theme="vs-light"
                language="javascript"
                value={liveCode}
                options={{ readOnly: true, domReadOnly: true, minimap: { enabled: false } }}
              />
            </Box>
            <Box style={{ width: "30%", minWidth: "200px", flexShrink: 0 }}>
              <ChatBox socket={socket} roomId={roomId} userId={userId} messages={messages} setMessages={setMessages} role="Quality" isSpectator={isSpectator} />
            </Box>
          </Box>

          {/* Bottom Row: Testing Board */}
          <Box style={{ flex: "1 1 40%", backgroundColor: "#1e1e1e", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Box p="xs" style={{ borderBottom: "1px solid #444" }}>
              <Group justify="space-between">
                <Tabs value={activeTab} onChange={setActiveTab} variant="outline" color="gray">
                  <Tabs.List>
                    {testCases.map((test) => (
                      <Tabs.Tab key={test.id} value={test.id} style={{ color: "white" }}>Test {test.id}</Tabs.Tab>
                    ))}
                    {testCases.length < 5 && !isSpectator && (
                      <Button variant="subtle" size="compact-xs" color="gray" onClick={addNewTest}>+</Button>
                    )}
                  </Tabs.List>
                </Tabs>
                <Group gap="xs">
                  <Button size="compact-xs" variant="outline" color="gray" disabled={isSpectator}>Debug</Button>
                  <Button size="compact-xs" variant="filled" color="blue" disabled={isSpectator}>Run Test</Button>
                </Group>
              </Group>
            </Box>
            <Box style={{ flex: 1 }}>
              <Editor 
                height="100%" 
                theme="vs-dark" 
                value={testCases.find(test => test.id === activeTab)?.content}
                onChange={(val) => handleTestCaseChange(activeTab!, val)}
                defaultLanguage="javascript" 
                options={{ readOnly: isSpectator, minimap: { enabled: false }, fontSize: 13 }} 
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}