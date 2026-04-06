<div align="center">

# Autosuggestion Quiz
[![Report Issue on Jira](https://img.shields.io/badge/Report%20Issues-Jira-0052CC?style=flat&logo=jira-software)](https://temple-cis-projects-in-cs.atlassian.net/jira/software/c/projects/ASQ/issues)
[![Deploy Docs](https://github.com/Capstone-Projects-2026-spring/project-auto-suggestion-quiz/actions/workflows/deploy.yml/badge.svg)](https://github.com/Capstone-Projects-2026-spring/project-auto-suggestion-quiz/actions/workflows/deploy.yml)
[![Documentation Website Link](https://img.shields.io/badge/-Documentation%20Website-brightgreen)](https://capstone-projects-2026-spring.github.io/project-auto-suggestion-quiz/)


</div>


## Keywords

AI suggested code, quizzes, educational, leetcode, practice

## Project Abstract

AutoSuggestion Quiz is a web-based educational application that helps students develop critical thinking skills when working with AI-generated code commonly found in modern IDEs. Teachers create and upload quizzes, and students can write and run code directly in the platform while answering by selecting from multiple-choice code suggestions. After submission, teachers can score responses and provide feedback. This format encourages students to question AI-generated code and builds confidence in tackling complex programming problems.

## High Level Requirement

Describe the requirements – i.e., what the product does and how it does it from a user point of view – at a high level.

## Conceptual Design

The frontend is built with React (Create React App), providing a Monaco editor-based coding environment where students write and run Python code directly in the browser using Pyodide. The backend is implemented in Python using FastAPI, which handles teacher authentication, problem management, AI suggestion generation, and submission storage. The database is PostgreSQL hosted on Supabase. AI code suggestions are generated via the OpenAI API (GPT-4o mini). OTP-based teacher authentication is handled through Supabase's email auth service.

## Background

AutoSuggestion Quiz (ASQ) was created to address the problem of students accepting AI-suggested code without fully understanding it. Many students rely on these suggestions because they are unsure how to approach LeetCode-style questions, which can often be challenging.

ASQ helps solve this issue by presenting students with options for the next line of auto-suggested code. This gives them direction while encouraging them to think critically about how to solve the problem and evaluate AI-generated suggestions. After a code option is selected, an explanation is provided to clarify why the AI suggested that code.

ASQ also supports teachers by allowing them to upload problems and give students opportunities to practice solving challenging coding tasks. In this way, ASQ helps students build confidence, improve problem-solving skills, and develop a deeper understanding of the code they use.

## Required Resources

- Windows 11 / macOS
- Internet access
- [Node.js](https://nodejs.org) v16+
- [Python](https://www.python.org) 3.10+
- A free [Supabase](https://supabase.com) account (PostgreSQL database and OTP auth)
- An [OpenAI API key](https://platform.openai.com/api-keys) for AI code suggestions

---

## Running Locally

For full setup instructions including Supabase configuration, schema SQL, environment variables, and how to run all tests, see [LOCAL_SETUP.md](./LOCAL_SETUP.md).

---

## First Release

Live app: https://autosuggestions.onrender.com/

## Features
  - Teachers can create an account by entering their email and receiving a one-time password.
  - Teachers can access their dashboard and create problems by providing a problem prompt and boilerplate code for the student to start with.
  - Teachers will receive a one-time password after creating a problem. Save this password to distribute to students.
  - Students can access their problems by using the one-time password for the assignment (one-time password provided by the teacher).
  - Students can attempt a problem and will be prompted with AI suggestions whenever they are inactive for a short period of time.
  - Python is the only language available currently.

## Collaborators
Bwosley
Temi Raymond
Yong Huang
Ethan Friedman
Henry Le
Aidan McCammitt


