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

Devices: Hardware/software must be present in order for application usage.

Windows 11/Mac OS compatibility
Internet Access
Technology: Programming languages, frameworks, API.

Python
Use of the OpenAI API key for the AI coding assistant and functionality.

## First Release

Use this link to access the current version of Autosuggestion Quiz: https://autosuggestions.onrender.com/

To run the project locally, run the following commands:
```
cd frontend
npm install
npm run start
```

To test the backend, run the following command in your terminal:
```
cd backend
pip install pytest
python pytest test_back.py
```
To test the frontend, run the following command in your terminal:
```
cd frontend
npm test
a
```
a will run all of the tests

Features
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
