import { Paper, Text, Group, Box, Badge, Title, Divider, Code } from "@mantine/core";

export interface AnalysisBoxProps {
  team1Code: string;
  team2Code?: string;
}
export default function AnalysisBox({ team1Code, team2Code }: AnalysisBoxProps) {
  const hasAnyCode = Boolean(team1Code || team2Code);

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      
      <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Title order={4} mb="sm" c="blue.7">Solution Analysis</Title>
        <Text size="sm" c="dimmed" lh={1.6}>
          {hasAnyCode ?'' : 'Waiting for code'}
        </Text>

        <Box style={{ marginTop: '0.75rem', maxHeight: '220px', overflowY: 'auto', overflowX: 'auto', paddingRight: '0.25rem' }}>
          {team1Code ? (
            <Code block mt={0} ff="monospace">
              {team1Code}
            </Code>
          ) : null}

          {team2Code ? (
            <Code block mt="sm" ff="monospace">
              {team2Code}
            </Code>
          ) : null}
        </Box>
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