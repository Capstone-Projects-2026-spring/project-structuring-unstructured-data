import { Paper, Text, Group, Box, Badge, Title, Divider, Code } from "@mantine/core";

export interface AnalysisBoxProps {
  team1Code: string;
  team2Code?: string;
}
export default function AnalysisBox({ team1Code, team2Code }: AnalysisBoxProps) {
  const hasAnyCode = Boolean(team1Code || team2Code);

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      
      <Box style={{ flex: 1 }}>
        <Title order={4} mb="sm" c="blue.7">Solution Analysis</Title>
        <Text size="sm" c="dimmed" lh={1.6}>
          {hasAnyCode ?'' : 'Waiting for code'}
        </Text>

        {team1Code ? (
          <Code block mt="sm" ff="monospace">
            {team1Code}
          </Code>
        ) : null}

        {team2Code ? (
          <Code mt="sm" ff="monospace">
            {team2Code}
          </Code>
        ) : null}
      </Box>

      <Divider my="md" />

      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>Performance Metrics</Text>
        
        <Group gap="xs">
          <Badge color="teal" variant="light" size="lg" radius="sm">
            Runtime: A
          </Badge>
          <Badge color="yellow" variant="light" size="lg" radius="sm">
            Space: B
          </Badge>
          <Badge color="orange" variant="light" size="lg" radius="sm">
            Time: C
          </Badge>
        </Group>
      </Group>

    </Paper>
  );
}