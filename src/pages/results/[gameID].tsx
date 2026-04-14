import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { Container, Box, Button, Center, Loader } from "@mantine/core";
import {
  IconTrophy,
  IconClock,
  IconCode,
  IconMedal,
  IconCheck,
  IconX,
  IconFlame,
  IconTarget,
  IconBolt,
  IconArrowRight,
  IconHome
} from "@tabler/icons-react";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { usePostHog } from "posthog-js/react";
import { GameType } from "@prisma/client";
import styles from "@/styles/Results.module.css";
import { ActiveProblem } from "@/components/ProblemBox";

// Mock data - replace with actual data from backend
interface TeamResult {
  name: string;
  score: number;
  testsPassed: number;
  totalTests: number;
  time: number; // in seconds
  isWinner: boolean;
}

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
}

interface RoomDetailsResponse {
  gameType: GameType;
}

// Animated counter hook
function useCounter(end: number, duration: number = 1500, delay: number = 0) {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp;
        }

        const progress = timestamp - startTimeRef.current;
        const percentage = Math.min(progress / duration, 1);

        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - percentage, 4);
        const current = Math.floor(easeOutQuart * end);

        setCount(current);

        if (percentage < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [end, duration, delay]);

  return count;
}

// Format time helper
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function Page() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  // Early auth check to prevent loading all the heavy stuff
  // if we aren't even logged in
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth");
    }
  }, [isPending, session, router]);
  return <Results />;
}

export function Results() {
  //grab id from url
  const router = useRouter();
  const { gameID } = router.query;
  const { data: session } = authClient.useSession();
  const [problem, setProblem] = useState<ActiveProblem | null>(null);
  const posthog = usePostHog();
  const [gameType, setGameType] = useState<GameType>(GameType.FOURPLAYER);
  const [isGameTypeLoading, setIsGameTypeLoading] = useState(true);

  useEffect(() => {
    posthog.capture("results_viewed");
  }, [posthog]);

  useEffect(() => {
    if (!router.isReady || !session?.user.id) return;

    if (typeof gameID !== "string") {
      setIsGameTypeLoading(false);
      return;
    }

    const loadGameType = async () => {
      try {
        const response = await fetch(`/api/rooms/${gameID}/${session.user.id}`);
        if (!response.ok) return;

        const roomDetails = (await response.json()) as RoomDetailsResponse;
        setGameType(roomDetails.gameType);
      } catch (error) {
        console.error("Failed to load room details for results page", error);
      } finally {
        setIsGameTypeLoading(false);
      }
    };

    loadGameType();
  }, [gameID, router.isReady, session?.user.id]);

  const isCoOp = gameType === GameType.TWOPLAYER;

  // Mock data - replace with actual fetched data
  const coOpTeam: TeamResult = {
    name: "Co-Op Crew",
    score: 810,
    testsPassed: 9,
    totalTests: 10,
    time: 236, // 3:56
    isWinner: true
  };

  const greenTeam: TeamResult = {
    name: "Green Hackers",
    score: 850,
    testsPassed: 8,
    totalTests: 10,
    time: 245, // 4:05
    isWinner: true
  };

  const redTeam: TeamResult = {
    name: "Red Coders",
    score: 720,
    testsPassed: 7,
    totalTests: 10,
    time: 312, // 5:12
    isWinner: false
  };

  const primaryTeam = isCoOp ? coOpTeam : greenTeam;
  const secondaryTeam = isCoOp ? null : redTeam;

  const testResults: TestResult[] = [
    { id: 1, name: "Basic Input", passed: true, input: "[1,2,3]", expected: "6", actual: "6" },
    { id: 2, name: "Edge Case - Empty", passed: true, input: "[]", expected: "0", actual: "0" },
    { id: 3, name: "Large Numbers", passed: true, input: "[100,200,300]", expected: "600", actual: "600" },
    { id: 4, name: "Negative Values", passed: false, input: "[-1,-2,-3]", expected: "-6", actual: "Error" },
    { id: 5, name: "Mixed Values", passed: true, input: "[1,-1,2,-2]", expected: "0", actual: "0" },
  ];

  const winner = secondaryTeam ? (primaryTeam.isWinner ? primaryTeam : secondaryTeam) : primaryTeam;

  // Animated counters
  const animatedScore = useCounter(winner.score, 2000, 200);
  const animatedTests = useCounter(winner.testsPassed, 1500, 400);
  const animatedTime = useCounter(winner.time, 1800, 600);

  if (!session) return null;

  if (isGameTypeLoading) {
    return (
      <div className={styles.resultsPage}>
        <div className={styles.gradient} />
        <Navbar
          links={["Time", "Players", "Tournament"]}
          title="Code BattleGrounds"
        />
        <Center style={{ minHeight: "60vh", position: "relative", zIndex: 1 }}>
          <Loader color="console" size="lg" />
        </Center>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Match Results | Code BattleGrounds</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.resultsPage}>
        <div className={styles.gradient} />

        <Navbar
          links={["Time", "Players", "Tournament"]}
          title="Code BattleGrounds"
        />

        <Container className={styles.container} size="xl">
          {/* Victory Banner */}
          <Box className={styles.victoryBanner}>
            <IconTrophy size={80} className={styles.trophyIcon} />
            <h1 className={styles.victoryTitle}>
              Victory!
            </h1>
            <p className={styles.victorySubtitle}>
              <span className={styles.winnerTeamName}>{winner.name}</span>{" "}
              {isCoOp ? "cleared the co-op challenge" : "dominated the battlefield"}
            </p>
          </Box>

          {/* Key Metrics */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>
                <IconTrophy size={16} />
                Final Score
              </div>
              <div className={styles.metricValue}>
                {animatedScore}
              </div>
              <IconMedal size={64} className={styles.metricIcon} />
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>
                <IconTarget size={16} />
                Tests Passed
              </div>
              <div className={styles.metricValue}>
                {animatedTests}/{winner.totalTests}
              </div>
              <IconCode size={64} className={styles.metricIcon} />
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>
                <IconClock size={16} />
                Completion Time
              </div>
              <div className={styles.metricValue}>
                {formatTime(animatedTime)}
              </div>
              <IconBolt size={64} className={styles.metricIcon} />
            </div>
          </div>

          {/* Team Comparison */}
          {!isCoOp && secondaryTeam && (
            <div className={styles.comparisonSection}>
              <h2 className={styles.sectionTitle}>Team Performance</h2>

              <div className={styles.comparisonCard}>
                <div className={styles.comparisonHeader}>
                  <div className={styles.teamHeader}>
                    <div className={`${styles.teamName} ${primaryTeam.isWinner ? styles.teamNameWinner : styles.teamNameLoser}`}>
                      {primaryTeam.name}
                    </div>
                    <div className={`${styles.teamBadge} ${primaryTeam.isWinner ? styles.winnerBadge : styles.loserBadge}`}>
                      {primaryTeam.isWinner ? (
                        <>
                          <IconTrophy size={16} />
                          Winner
                        </>
                      ) : (
                        "Runner-up"
                      )}
                    </div>
                  </div>

                  <div className={styles.vsText}>VS</div>

                  <div className={styles.teamHeader}>
                    <div className={`${styles.teamName} ${secondaryTeam.isWinner ? styles.teamNameWinner : styles.teamNameLoser}`}>
                      {secondaryTeam.name}
                    </div>
                    <div className={`${styles.teamBadge} ${secondaryTeam.isWinner ? styles.winnerBadge : styles.loserBadge}`}>
                      {secondaryTeam.isWinner ? (
                        <>
                          <IconTrophy size={16} />
                          Winner
                        </>
                      ) : (
                        "Runner-up"
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.comparisonBody}>
                  <div className={styles.comparisonRow}>
                    <div className={`${styles.statValue} ${primaryTeam.score >= secondaryTeam.score ? styles.statValueWinner : styles.statValueLoser}`}>
                      {primaryTeam.score}
                    </div>
                    <div className={styles.statLabel}>Score</div>
                    <div className={`${styles.statValue} ${secondaryTeam.score >= primaryTeam.score ? styles.statValueWinner : styles.statValueLoser}`}>
                      {secondaryTeam.score}
                    </div>
                  </div>

                  <div className={styles.comparisonRow}>
                    <div className={`${styles.statValue} ${primaryTeam.testsPassed >= secondaryTeam.testsPassed ? styles.statValueWinner : styles.statValueLoser}`}>
                      {primaryTeam.testsPassed}/{primaryTeam.totalTests}
                    </div>
                    <div className={styles.statLabel}>Tests Passed</div>
                    <div className={`${styles.statValue} ${secondaryTeam.testsPassed >= primaryTeam.testsPassed ? styles.statValueWinner : styles.statValueLoser}`}>
                      {secondaryTeam.testsPassed}/{secondaryTeam.totalTests}
                    </div>
                  </div>

                  <div className={styles.comparisonRow}>
                    <div className={`${styles.statValue} ${primaryTeam.time <= secondaryTeam.time ? styles.statValueWinner : styles.statValueLoser}`}>
                      {formatTime(primaryTeam.time)}
                    </div>
                    <div className={styles.statLabel}>Time</div>
                    <div className={`${styles.statValue} ${secondaryTeam.time <= primaryTeam.time ? styles.statValueWinner : styles.statValueLoser}`}>
                      {formatTime(secondaryTeam.time)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Cards */}
          <div className={styles.performanceSection}>
            <h2 className={styles.sectionTitle}>{isCoOp ? "Co-Op Performance" : "Performance Breakdown"}</h2>

            <div className={styles.performanceGrid}>
              <div className={styles.performanceCard}>
                <div className={styles.performanceHeader}>
                  <div className={styles.performanceTitle}>Accuracy</div>
                  <IconTarget size={24} className={styles.performanceIcon} />
                </div>
                <div className={styles.performanceScore}>
                  {Math.round((primaryTeam.testsPassed / primaryTeam.totalTests) * 100)}%
                </div>
                <div className={styles.performanceDescription}>
                  Excellent test coverage with {primaryTeam.testsPassed} out of {primaryTeam.totalTests} tests passing
                </div>
              </div>

              <div className={styles.performanceCard}>
                <div className={styles.performanceHeader}>
                  <div className={styles.performanceTitle}>Speed</div>
                  <IconBolt size={24} className={styles.performanceIcon} />
                </div>
                <div className={styles.performanceScore}>
                  A+
                </div>
                <div className={styles.performanceDescription}>
                  {isCoOp
                    ? `Completed in ${formatTime(primaryTeam.time)} with strong coordination and pace`
                    : `Completed in ${formatTime(primaryTeam.time)} - faster than ${primaryTeam.time < secondaryTeam!.time ? "80%" : "60%"} of teams`}
                </div>
              </div>

              <div className={styles.performanceCard}>
                <div className={styles.performanceHeader}>
                  <div className={styles.performanceTitle}>Efficiency</div>
                  <IconFlame size={24} className={styles.performanceIcon} />
                </div>
                <div className={styles.performanceScore}>
                  {primaryTeam.score}
                </div>
                <div className={styles.performanceDescription}>
                  {isCoOp
                    ? "Outstanding co-op execution balancing speed, quality, and collaboration"
                    : "Outstanding score combining speed, accuracy, and code quality"}
                </div>
              </div>
            </div>
          </div>

          {/* Test Results */}
          <div className={styles.testResultsSection}>
            <h2 className={styles.sectionTitle}>{isCoOp ? "Co-Op Test Case Results" : "Test Case Results"}</h2>

            <div className={styles.testResultsCard}>
              <div className={styles.testResultsHeader}>
                <div className={styles.testResultsTitle}>
                  All Test Cases
                </div>
              </div>

              <div className={styles.testResultsBody}>
                {testResults.map((test) => (
                  <div key={test.id} className={styles.testRow}>
                    <div className={`${styles.testStatus} ${test.passed ? styles.testStatusPass : styles.testStatusFail}`}>
                      {test.passed ? <IconCheck size={18} /> : <IconX size={18} />}
                    </div>
                    <div className={styles.testInfo}>
                      <div className={styles.testName}>
                        Test {test.id}: {test.name}
                      </div>
                      <div className={styles.testDetails}>
                        Input: {test.input} → Expected: {test.expected} | Got: {test.actual}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actionsSection}>
            <Button
              size="lg"
              variant="filled"
              color="console"
              className={styles.primaryButton}
              rightSection={<IconArrowRight size={20} />}
              onClick={() => router.push('/matchmaking')}
            >
              Play Again
            </Button>

            <Button
              size="lg"
              variant="outline"
              color="console"
              className={styles.secondaryButton}
              leftSection={<IconHome size={20} />}
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </Container>
      </div>
    </>
  );
}
