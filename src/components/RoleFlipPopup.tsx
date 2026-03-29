import { Modal, Text, Stack } from "@mantine/core";
import { GameStatus } from "@prisma/client";

interface RoleFlipPopupProps {
  gameState: GameStatus;
}

export default function RoleFlipPopup({ gameState }: RoleFlipPopupProps) {
  const isWarning = gameState === GameStatus.ROLE_SWAP_WARNING;
  const isFlipping = gameState === GameStatus.FLIPPING;

  return (
    <Modal
      opened={isWarning || isFlipping}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      centered
      size="sm"
      overlayProps={{ blur: 3 }}
    >
      <Stack align="center" py="md" gap="xs">
        {isWarning ? (
          <>
            <Text size="xl" fw={600}>Role swap in 1 minute!</Text>
            <Text size="sm" c="dimmed">Get ready to switch roles...</Text>
          </>
        ) : (
          <>
            <Text size="xl" fw={600}>Roles flipping!</Text>
            <Text size="sm" c="dimmed">Ooh, switching things up...</Text>
          </>
        )}
      </Stack>
    </Modal>
  );
}