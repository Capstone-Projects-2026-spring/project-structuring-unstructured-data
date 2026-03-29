-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,

    CONSTRAINT "LobbyMember_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LobbyMember" ADD CONSTRAINT "LobbyMember_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
