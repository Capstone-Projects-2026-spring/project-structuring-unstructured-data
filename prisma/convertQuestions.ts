#!/usr/bin/env bun

import * as csv from "csv";
import * as fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { platform } from "node:os";
import { Database, TablesInsert } from "@/lib/supabase.types";

let IMPORT_PATH = "./assets/CSVs/pd-chemistry-2.csv";
const ENV_PATH = ".env.development.local";
const DRY_RUN = true;

// Check the `exams` table for the correct exam ID
const EXAM_NO = 7;

const { parsed: parsedEnv } = dotenv.config({
  path: ENV_PATH,
  debug: false
});

if (!parsedEnv || !parsedEnv.EXPO_PUBLIC_SUPABASE_URL || !parsedEnv.INTERNAL_SUPABASE_SERVICE_KEY) {
  throw "Missing env variables";
}

const supabaseAdmin = createClient<Database>(
  parsedEnv.EXPO_PUBLIC_SUPABASE_URL,
  parsedEnv.INTERNAL_SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

if (platform() === "win32") {
  IMPORT_PATH = IMPORT_PATH.replace(/\\/g, "/");
}

const processFile = async () => {
  console.log("Processing...");
  
  if (DRY_RUN) {
    console.warn("========= WARNING =========\nRunning in DRY_RUN mode. No changes will be made to the database.");
    console.warn("If you are sure you want to insert the questions, please set DRY_RUN to false.");

    console.warn("\nAre you sure you want to continue in DRY_RUN mode? (y/N)");
    const response = prompt(">");
    if (response?.toLowerCase() !== "y") {
      console.log("Aborting...");
      return;
    }
  }

  // Fetch existing categories for this exam
  console.log("Fetching existing question categories...");
  const { data: existingCategories } = await supabaseAdmin
    .from("question_categories")
    .select("id, category_name")
    .eq("exam_id", EXAM_NO);

  const categories = new Map<string, number>();
  if (existingCategories) {
    existingCategories.forEach(cat => {
      categories.set(cat.category_name, cat.id);
    });
    console.log(`Found ${existingCategories.length} existing categories`);
  }

  // Fetch existing sections for this exam
  console.log("Fetching existing exam sections...");
  const { data: existingSections } = await supabaseAdmin
    .from("exam_sections")
    .select("id, section_name")
    .eq("exam", EXAM_NO);

  const sections = new Map<string, number>();
  if (existingSections) {
    existingSections.forEach(sec => {
      sections.set(sec.section_name, sec.id);
    });
    console.log(`Found ${existingSections.length} existing sections`);
  }

  // Fetch existing questions for this exam to check for duplicates
  console.log("Fetching existing questions...");
  const { data: existingQuestions } = await supabaseAdmin
    .from("questions")
    .select("question")
    .eq("exam", EXAM_NO);

  const questionSet = new Set<string>();
  if (existingQuestions) {
    existingQuestions.forEach(q => {
      questionSet.add(q.question);
    });
    console.log(`Found ${existingQuestions.length} existing questions`);
  }

  const parser = fs
    .createReadStream(IMPORT_PATH)
    .pipe(
      csv.parse({
        delimiter: ",",
        trim: true,
        from_line: 2,
        skipEmptyLines: true,
        skip_empty_lines: true,
        skipRecordsWithError: true,
        skip_records_with_error: true,
        skipRecordsWithEmptyValues: true,
        skip_records_with_empty_values: true,
      })
    );

  let skippedDuplicates = 0;

  const questionsToInsert: TablesInsert<"questions">[] = [];

  for await (const record of parser) {
    const [
      section,
      category,
      question,
      // _,
      choiceA,
      choiceB,
      choiceC,
      choiceD,
      answer,
      explanation,
      // image,
    ] = record;

    if (!question || !answer) {
      console.error({
        section,
        category,
        question,
        choiceA,
        choiceB,
        choiceC,
        choiceD,
        answer,
        // image,
        explanation
      });
      throw "Invalid question";
    }

    if (![choiceA, choiceB, choiceC, choiceD].includes(answer)) {
      console.error({
        section,
        category,
        question,
        choiceA,
        choiceB,
        choiceC,
        choiceD,
        answer,
        // image,
        explanation
      });
      throw "Invalid answer";
    }

    // Check for duplicate questions
    if (questionSet.has(question)) {
      skippedDuplicates++;
      continue;
    }
    questionSet.add(question);

    if (!categories.has(category)) {
      if (DRY_RUN) {
        categories.set(category, categories.size + 1);
      } else {
        const { data, error } = await supabaseAdmin.from("question_categories")
        .insert({
          exam_id: EXAM_NO,
          category_name: category
        })
        .select("id")
        .limit(1)
        .single();

        if (error || !data) throw error;

        categories.set(category, data.id);
      }
    }

    if (!sections.has(section)) {
      if (DRY_RUN) {
        sections.set(section, sections.size + 1);
      } else {
        const { data, error } = await supabaseAdmin.from("exam_sections")
          .insert({
            section_name: section,
            exam: EXAM_NO
          })
          .select("id")
          .limit(1)
          .single();

        if (error || !data) throw error;

        sections.set(section, data.id);
      }
    }

    // console.log({
    //   section: sections.get(section),
    //   category: categories.get(category),
    //   question,
    //   choiceA,
    //   choiceB,
    //   choiceC,
    //   choiceD,
    //   answer,
    //   // image,
    //   explanation
    // });

    questionsToInsert.push({
      exam: EXAM_NO,
      exam_section: sections.get(section)!,
      category_id: categories.get(category)!,
      question,
      choices: [choiceA, choiceB, choiceC, choiceD],
      answer,
      explanation
    });

    if (DRY_RUN) continue;

    // const { error } = await supabaseAdmin.from("questions")
    //   .insert({
    //     exam: EXAM_NO,
    //     exam_section: sections.get(section)!,
    //     category_id: categories.get(category)!,
    //     question,
    //     choices: [choiceA, choiceB, choiceC, choiceD],
    //     answer,
    //     explanation
    //   });

    // if (error) throw error;
  }

  if (DRY_RUN) {
    console.log("DRY_RUN mode. No changes made to the database.");
    console.log("Questions to insert:", questionsToInsert.length);
    console.log("Skipped duplicates:", skippedDuplicates);
    return;
  }

  const chunkSize = 100;
  const chunks = chunkArray(questionsToInsert, chunkSize);

  console.log("Inserting questions in chunks of", chunkSize);
  for (const chunk of chunks) {
    const { error } = await supabaseAdmin.from("questions")
      .insert(chunk);

    if (error) {
      console.error("Error inserting chunk:", error);
      console.error("Chunk data:", chunk);
      throw error;
    }
    console.log("Inserted chunk of size", chunk.length);
  }

  console.log("Inserted all questions.");

  console.log("Done processing file.");
  console.log("Total new questions processed:", questionsToInsert.length);
  console.log("Total duplicates skipped:", skippedDuplicates);
};

processFile();

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}