import React, { useEffect, useState } from "react";
import { Box, Group, Button, Select, Text, Tabs } from "@mantine/core";
import Editor from "@monaco-editor/react";
import Navbar from "@/components/Navbar";
import ProblemBox from "@/components/ProblemBox";
import ChatBox from "@/components/ChatBox";
import GameTimer from "@/components/GameTimer";
import RoleFlipPopup from "@/components/RoleFlipPopup";
import { Socket } from "socket.io-client"; // <-- 1. Import Socket type
import { GameStatus } from "@prisma/client";
import { Message } from "@/components/ChatBox"

interface CoderPOVProps {
  socket: Socket;
  roomId: string;
  userId: string;
  liveCode: string;
  setLiveCode: React.Dispatch<React.SetStateAction<string>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  endTimeRef: number;
  duration: number;
  gameState: GameStatus;
  isSpectator?: boolean;
}

export default function CoderPOV({
  socket,
  roomId,
  userId,
  liveCode,
  setLiveCode,
  messages,
  setMessages,
  endTimeRef,
  duration,
  gameState,
  isSpectator = false,
}: CoderPOVProps) {
  const [activeTab, setActiveTab] = useState<string | null>("console");

  useEffect(() => {
    const handler = (newCode: string) => {
      setLiveCode(newCode);
    };
    socket.on("receiveCodeUpdate", handler);
    return () => {
      socket.off("receiveCodeUpdate", handler);
    };
  }, [socket]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && !isSpectator) {
      socket.emit("codeChange", { teamId: roomId, code: value });
    }
  };

  return (
    <Box
      data-testid="coder-pov"
      h="100vh"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <RoleFlipPopup gameState={gameState} /> 
      <Navbar
        links={["Timer", "Players", "Tournament"]}
        title="CODE BATTLEGROUNDS | GAMEMODE: TIMER"
        isSpectator={isSpectator}
      />

      <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Box
          style={{
            width: "20%",
            minWidth: "250px",
            backgroundColor: "#333",
            color: "white",
            padding: "1rem",
            overflowY: "auto",
            display: "block",
          }}
        >
          {(gameState === GameStatus.ACTIVE || gameState === GameStatus.FLIPPING) && (
            <Box mb="md">
              <GameTimer endTime={endTimeRef} duration={duration} />
            </Box>
          )}
          <ProblemBox />
        </Box>

        {/* Main Workspace */}
        <Box
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <Group
            p="xs"
            bg="#f8f9fa"
            style={{ borderBottom: "1px solid #ddd", flexShrink: 0 }}
          >
            <Select
              size="xs"
              data={["Javascript"]}
              defaultValue="Javascript"
              disabled={isSpectator}
            />
            <Button size="xs" color="cyan" disabled={isSpectator}>
              RUN ▷
            </Button>
            <Button size="xs" color="green" disabled={isSpectator}>
              Submit Final Code
            </Button>
          </Group>

          {/* Middle Row: Editor & Chat */}
          <Box
            style={{
              display: "flex",
              flex: "1 1 45%",
              borderBottom: "2px solid #333",
              minHeight: 0,
            }}
          >
            <Box
              style={{ flex: 1, borderRight: "1px solid #ddd", minWidth: 0 }}
            >
              <Editor
                height="100%"
                theme="vs-dark"
                defaultLanguage="javascript"
                value={liveCode}
                onChange={handleEditorChange}
                options={{ readOnly: isSpectator, minimap: { enabled: false } }}
              />
            </Box>
            <Box style={{ width: "30%", minWidth: "200px" }}>
              <ChatBox
                socket={socket}
                roomId={roomId}
                userId={userId}
                messages={messages}
                setMessages={setMessages}
                role="coder"
                isSpectator={isSpectator}
              />
            </Box>
          </Box>

          {/* Bottom Row: Console */}
          <Box
            style={{
              flex: "1 1 35%",
              backgroundColor: "#1e1e1e",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <Box p="xs" style={{ borderBottom: "1px solid #444" }}>
              <Tabs
                value={activeTab}
                onChange={setActiveTab}
                variant="outline"
                color="gray"
              >
                <Tabs.List>
                  <Tabs.Tab value="console" style={{ color: "white" }}>
                    Console Output
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs>
            </Box>
            <Box style={{ flex: 1 }}>
              <Editor
                height="100%"
                theme="vs-dark"
                defaultLanguage="javascript"
                options={{ readOnly: true, minimap: { enabled: false } }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
