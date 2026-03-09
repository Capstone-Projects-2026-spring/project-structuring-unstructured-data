---
sidebar_position: 2
---
# Integration tests

Tests to demonstrate each use-case based on the use-case descriptions and the sequence diagrams. External input should be provided via mock objects and results verified via mock objects. Integration tests should not require manual entry of data nor require manual interpretation of results.





















Integration Tests

We will be using Pytest for backend and React Testing Library for the frontend. Integration tests will be based on the use cases description for the teacher and student.

Teacher User: 

Use Case 1: Account creation
This is done using RTL and rendering the full application
verify that the account creation form is displayed when the application loads.
simulate the user entering a valid email address and university name.
simulate clicking the “Create Account” button.
confirm that the mocked OTP API was called with the correct parameters.
verify that the OTP input field appears after the OTP is successfully “sent”.
simulate entering a valid OTP.
simulate clicking the verification button.
verify that the OTP verification mock was called with the correct data.
After successful OTP verification, assert that
A success message is displayed
The user is redirected to the dashboard page (verified by checking that dashboard content is rendered or that the route changes)
Use Case 2: Signing in
Frontend Testing (RTL)
Verify that when the application loads, the account creation/sign-in page is displayed.
Simulate the user clicking the “Login” button.
Verify that the sign-in page is displayed.
Simulate the user entering a valid email and password into the appropriate input fields.
Simulate clicking the “Sign In” button.
Verify that the mocked authentication API is called with the correct email and password.
If credentials are correct
Mock a successful authentication response.
Assert that the user is redirected to the dashboard page by verifying that dashboard content is rendered or that the route changes.
If not,
Mock a successful authentication response.
Assert that the user is redirected to the dashboard page by verifying that dashboard content is rendered or that the route changes.
Pytest, should be tested independently from frontend
Successful Login
Send a POST request to the login endpoint with valid credentials.
Verify that:
The response status code indicates success 
A valid authentication token or session identifier is returned.
The correct user data is included in the response.
Invalid Credentials
Send a POST request with
Incorrect password
Non-existent email
Verify that
The response status code indicates failure 
A error message is returned
No authentication token is issued
Edge Case
Missing email field
Missing password field
Empty inputs
Malformed email format
Use case 3: Uploading Leetcode Problems
Frontend Test
Verify that the dashboard page is displayed after login.
Simulate the user clicking the “Upload Problem Set” button.
Verify that the application redirects to the Upload Problem page.
Confirm that input fields for:
Question
Multiple-choice answers
Code boilerplate
 are displayed.
Simulate the user entering:
A valid problem question
Multiple possible answers
A valid code boilerplate
Simulate toggling quiz restriction settings such as:
Show correct answer


Allow multiple attempts
Any other restriction options provided
Simulate clicking the “Submit” or “Upload” button.
Verify that the mocked backend API responsible for saving the problem set is called with:
The question text
The answer options
The code boilerplate
The selected restriction settings
Mock a successful API response and assert that:
A success message is displayed
The user is redirected back to the dashboard
 OR
The newly uploaded problem appears in a list of available quizzes
Backend Testing (pytest)
Successful Problem Upload
Send a POST request to the problem upload endpoint containing:
Question text
Multiple-choice answers
Code boilerplate
Restriction settings
Verify that:
The response status code indicates success (e.g., 201 Created).
The problem is correctly stored in the test database.
The restriction settings are saved correctly.
The returned response contains the correct problem data.
Validation 
Test invalid submissions
Missing question test
No answer options provided
Missing code boilerplate
Invalid restriction configuration
Verify that
The response status code indicates failure
An appropriate validation error message is returned
No problem is stored in the database
Use Case 4: Publishing Problems
Frontend Test (RTL)
Scenario 1 : successful publish
Render the application and navigate to a completed quiz editing page.
Verify that the “Publish” button is displayed at the bottom of the page.
Simulate clicking the “Publish” button.
Confirm that the mocked backend publish API is called with the correct quiz identifier.
Mock a successful backend response that includes a generated access key.
Assert that:
A pop-up or modal appears indicating that the quiz has been successfully published.
The generated access key is displayed in the pop-up.
The success message matches the expected output.
Scenario 2 : Incomplete Quiz
Render the application with a quiz that is missing required fields (e.g., no questions, missing answers, or missing restrictions).
Simulate clicking the “Publish” button.
Mock a backend validation failure response indicating that the quiz is incomplete.
Assert that:
An error notification is displayed.
The pop-up success modal does not appear.
No access key is shown.
Backend Test
Scenario 1 : Successful Publish
Create a valid, fully completed quiz in the test database.
Send a POST request to the publish endpoint with the quiz ID.
Verify that:
The response status code indicates success (e.g., 200 OK).
A unique access key is generated and returned.
The quiz’s status in the database changes to “published”.
The access key is stored in the database and linked to the quiz.
Scenario 2 : Incomplete Quiz
Create an incomplete quiz in the test database.
Send a POST request to the publish endpoint.
Verify that:
The response status code indicates failure (e.g., 400 Bad Request).
An appropriate validation error message is returned.
No access key is generated.
The quiz remains unpublished in the database.
Use case 5: Navigating Dashboard
Scenario 1 : viewing student progress
Render the application in an authenticated state so that the dashboard is displayed.
Verify that the dashboard contains buttons for:
Uploading quizzes
Viewing existing quizzes
Viewing student progress and grades
Simulate clicking the “View Student Progress and Grades” button.
Verify that the application redirects to the student progress page.
Confirm that:
A list of students or progress summaries is displayed.
A search input field is visible.
Simulate entering a student’s name in the search field.
Verify that the list updates to show matching results.
Simulate clicking on a specific student’s progress.
Assert that a modal or new window opens displaying:
The student’s progress
Their submitted answers
Scenario 2 : Grading and publishing (success)
With the student progress window open, verify that:
A grade input field is displayed.
A notes input field is available.
A “Save and Publish” button is visible.
Simulate entering a valid grade.
Simulate entering optional notes.
Simulate clicking “Save and Publish”.
Confirm that the mocked grading API is called with:
The correct student identifier
The entered grade
The notes (if provided)
Mock a successful backend response.
Assert that:
A success notification appears stating that the grade has been published.
The modal closes or updates to reflect the published status.
Scenario 3 : Incomplete Input Validation
Leave the grade field empty
Simulate clicking “Save and Publish”.
Assert that:


An error message appears prompting the user to complete required fields.
The mocked API is not called.
No success notification appears.
Backend Testing (pytest)
Scenario 1 Retrieving Student Progress
Insert sample student data and quiz submissions into the test database.
Send a GET request to the student progress endpoint.
Verify that:
The response status code indicates success.
The returned data includes correct student progress information.
Submitted answers are correctly returned.
Scenario 2 Saving and Publishing Grades (Successful Case)
Send a POST or PUT request to the grading endpoint with:
Student ID
Grade value
Notes (if applicable)
Verify that:
The response status code indicates success.
The grade is correctly stored in the database.
The grade status is updated to “published”.
The correct confirmation response is returned.
Scenario 3 Incomplete Input Validation
Attempt to submit a grade without a required field (for example, missing grade value).
Verify that:
The response status code indicates failure (for example, 400 Bad Request).
A validation error message is returned.
No grade is stored or published
Use case 7 - deleting a question from a quiz
Frontend (RTL)
Scenario 1 – Successful Question Deletion
Render the application in an authenticated state so that the dashboard is displayed.
Simulate clicking the “View Existing Quizzes” button.
Verify that the application redirects to the existing quizzes page.
Confirm that a list of quizzes is displayed.
Simulate selecting a specific quiz that contains multiple questions.


Verify that the quiz editing page is displayed and that each question has an associated “Delete” button.
Simulate clicking the “Delete” button next to a specific question.
Verify that a confirmation pop-up appears asking the user to confirm the deletion.
Simulate confirming the deletion.
Confirm that the mocked delete API is called with the correct quiz ID and question ID.
Mock a successful backend response.
Assert that:
The question is no longer displayed in the list of quiz questions.
A success notification appears indicating that the question was deleted successfully.
Scenario 2 – Deletion Cancelled
Navigate to the quiz editing page as described above.
Simulate clicking the “Delete” button for a question.
When the confirmation pop-up appears, simulate cancelling the action.


Assert that:
The delete API is not called.
The question remains visible in the quiz.
No success notification appears.
Backend (Pytest)
Scenario 1. Successful Question Deletion
Insert a quiz with multiple questions into the test database.
Send a DELETE request to the question deletion endpoint with the quiz ID and question ID.
Verify that:
The response status code indicates success (for example, 200 OK).
The specified question is removed from the database.
The quiz no longer contains the deleted question.
Scenario 2. Attempting to Delete a Non-Existent Question
Send a DELETE request using an invalid or non-existent question ID.
Verify that:
The response status code indicates failure (for example, 404 Not Found).
No other questions are affected.
