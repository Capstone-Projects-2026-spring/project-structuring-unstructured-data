<div align="center">

# Autosuggestion Quiz
[![Report Issue on Jira](https://img.shields.io/badge/Report%20Issues-Jira-0052CC?style=flat&logo=jira-software)](https://temple-cis-projects-in-cs.atlassian.net/jira/software/c/projects/DT/issues)
[![Deploy Docs](https://github.com/ApplebaumIan/tu-cis-4398-docs-template/actions/workflows/deploy.yml/badge.svg)](https://github.com/ApplebaumIan/tu-cis-4398-docs-template/actions/workflows/deploy.yml)
[![Documentation Website Link](https://img.shields.io/badge/-Documentation%20Website-brightgreen)](https://applebaumian.github.io/tu-cis-4398-docs-template/)


</div>


## Keywords

AI suggested code, quizzes, educational, leetcode, practice

## Project Abstract

AutoSuggestion Quiz is a web-based educational application that helps students develop critical thinking skills when working with AI-generated code commonly found in modern IDEs. Teachers create and upload quizzes, and students can write and run code directly in the platform while answering by selecting from multiple-choice code suggestions. After submission, teachers can score responses and provide feedback. This format encourages students to question AI-generated code and builds confidence in tackling complex programming problems.

## High Level Requirement

Describe the requirements – i.e., what the product does and how it does it from a user point of view – at a high level.

## Conceptual Design

The frontend of the application will be developed using JavaScript, React, HTML, and CSS. React will be used to build reusable user interface components and manage application state, while HTML and CSS will be used to structure and style the user interface. The frontend will allow users to select quiz topics, start quizzes, submit answers, and view results in real time.
The backend will be implemented using Python and Django, which will handle user authentication, quiz generation logic, scoring, and data management. The system will store user data, quiz attempts, and performance metrics in a relational database such as SQLite. The backend will also support algorithms that generate or suggest quiz questions based on predefined rules or user interaction history.
The application will be accessible through a standard web browser and designed to support multiple users concurrently, ensuring reliability and responsiveness.

## Background

AutoSuggestion Quiz (ASQ) was created to address the problem of students accepting AI-suggested code without fully understanding it. Many students rely on these suggestions because they are unsure how to approach LeetCode-style questions, which can often be challenging.

ASQ helps solve this issue by presenting students with options for the next line of auto-suggested code. This gives them direction while encouraging them to think critically about how to solve the problem and evaluate AI-generated suggestions. After a code option is selected, an explanation is provided to clarify why the AI suggested that code.

ASQ also supports teachers by allowing them to upload problems and give students opportunities to practice solving challenging coding tasks. In this way, ASQ helps students build confidence, improve problem-solving skills, and develop a deeper understanding of the code they use.

## Required Resources

- Windows 11 / macOS
- Internet access
- [Node.js](https://nodejs.org) v16+
- [Python](https://www.python.org) 3.10+
- An [OpenAI API key](https://platform.openai.com/api-keys) for AI code suggestions

---

## Running Locally

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows
pip install -r requirements.txt
```

**Environment variables**

Copy the template and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env`:

| Variable | Description | Required |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key for AI code suggestions | **Yes** |
| `DATABASE_URL` | PostgreSQL connection string for the backend database | **Yes** |
| `DEBUG` | Set to `True` in development | No |
| `SUPABASE_URL` | Your Supabase project URL | Only for OTP login |
| `SUPABASE_SERVICE_KEY` | Your Supabase anon/service key | Only for OTP login |
| `JUDGE0_URL` | Judge0 base URL, for example `http://localhost:2358` | For code execution |
| `JUDGE0_AUTH_TOKEN` | Optional auth token for a protected Judge0 instance | No |

**Start the server**

```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. The database is **created and seeded automatically** on first startup — no manual migration needed. A seed teacher (`seed@autoquiz.dev`) and a sample problem (access code `123456`) are added when the database is empty.

### Self-Hosted Compiler With Docker

The backend uses a local Judge0 CE instance for code execution. This keeps the existing `/code/execute` backend endpoint the same while moving compilation and execution onto your machine.

Start Judge0 locally:

```bash
./scripts/start_judge0.sh
```

Then set `JUDGE0_URL=http://localhost:2358` in `backend/.env` and start the backend normally.

Stop Judge0 when you are done:

```bash
./scripts/stop_judge0.sh
```

For Mac OS users when setting up Judge0 in terminal:
You will need docker to run this, the scripts will automatically set up docker, however, docker and judge0 has some incompatibility issues that will need adressing in the system files.

To start, close docker and every instance of it currently running.

You will need to locate the settings-store.json for docker in order to use the deprecatedCgroupv1.

In command prompt: ‘ open -a TextEdit "/Users/[Your Computer Name]/Library/Group Containers/group.com.docker/settings-store.json" ‘

And then paste this in place:
{
  "AutoStart": false,
  "DisplayedOnboarding": true,
  "DockerAppLaunchPath": "/Applications/Docker.app",
  "EnableDockerAI": true,
  "LastContainerdSnapshotterEnable": 1773866500,
  "LicenseTermsVersion": 2,
  "SettingsVersion": 43,
  "ShowInstallScreen": false,
  "UseContainerdSnapshotter": true,
  "deprecatedCgroupv1": true
}

Reopen docker, and the website should be able to read Judge0

---

### Frontend

```bash
cd frontend
npm install
```

> **Optional:** If your backend is not on the default port, create `frontend/.env` and set `REACT_APP_API_URL=http://localhost:<your_port>`. Otherwise no `.env` is needed.

**Start the app**

```bash
npm start
```

The app opens at `http://localhost:3000`.

---

### Supabase / OTP Login

All Supabase communication happens on the **backend** — the frontend does not need any Supabase credentials. To enable OTP email login:

1. Create a free account at [supabase.com](https://supabase.com).
2. Create a new project.
3. Go to **Project Settings → API**.
4. Copy the **Project URL** → paste as `SUPABASE_URL` in `backend/.env`.
5. Copy the **anon / public** key → paste as `SUPABASE_SERVICE_KEY` in `backend/.env`.

**Dev bypass — no Supabase account needed**

On the login page, enter `dev` as the email and click **Send OTP**. This skips Supabase entirely and signs you in as the seed teacher (`seed@autoquiz.dev`) without sending any email. This only works when `DEBUG=True` is set in `backend/.env`.

---

## Testing

### Backend

Make sure the virtual environment is activated, then run:

```bash
cd backend
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows
pytest backUnitTest/
```

### Frontend

```bash
cd frontend
npm test
```

Press `a` to run all tests.

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
Ethan Freidman
Henry Le
Aidan McCammitt

<div align="center">

[//]: # (Replace with your collaborators)
[Ian Tyler Applebaum](https://github.com/ApplebaumIan) • [Kyle Dragon Lee](https://github.com/leekd99)

</div>
