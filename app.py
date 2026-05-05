from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import json
import time
import os

app = Flask(__name__)
# Required for secure session management
app.secret_key = os.urandom(24) 

# Load JSON Data
with open('data.json') as f:
    app_data = json.load(f)

# Global dictionary for single-user activity tracking
user_data = {
    "start_time": None,
    "learning_activity": []
}

@app.route('/')
def home():
    # Clear all session data when returning to home
    session.clear()
    session.pop('lesson_times', None)
    user_data["learning_activity"] = []
    return render_template('home.html')

@app.route('/start', methods=['POST'])
def start():
    user_data["start_time"] = time.time()
    return redirect(url_for('select'))

@app.route('/select')
def select():
    if 'visited_lessons' not in session:
        session['visited_lessons'] = []
    
    visited = session['visited_lessons']
    total_lessons = len(app_data["lessons"])
    all_visited = len(visited) >= total_lessons
    
    # Pass 'lessons' and 'visited_lessons' to the template for the checklist
    return render_template('select.html', all_visited=all_visited, visited_lessons=visited, lessons=app_data["lessons"])

@app.route('/learn/<int:lesson_id>')
def learn(lesson_id):
    lesson = app_data["lessons"].get(str(lesson_id))
    
    if 'visited_lessons' not in session:
        session['visited_lessons'] = []
    
    visited = session['visited_lessons']
    if lesson_id not in visited:
        visited.append(lesson_id)
        session['visited_lessons'] = visited
        
    total_lessons = len(app_data["lessons"])
    all_visited = len(session['visited_lessons']) >= total_lessons

    # Log entry
    user_data["learning_activity"].append({
        "lesson": lesson_id,
        "entry_time": time.time(),
        "selections": []
    })
    
    return render_template('learn.html', lesson=lesson, lesson_id=lesson_id, all_visited=all_visited)

@app.route('/record_click', methods=['POST'])
def record_click():
    data = request.get_json()
    user_data["learning_activity"][-1]["selections"].append(data['selection'])
    return jsonify({"status": "success"})

@app.route('/record_time', methods=['POST'])
def record_time():
    # Handle the beacon payload
    data = request.get_json() if request.is_json else json.loads(request.data)
    
    lesson_id = str(data.get('lesson_id'))
    time_spent = data.get('time_spent', 0)
    
    if 'lesson_times' not in session:
        session['lesson_times'] = {}
        
    # Add the newly spent time to any existing time for this lesson
    current_time = session['lesson_times'].get(lesson_id, 0)
    session['lesson_times'][lesson_id] = current_time + time_spent
    session.modified = True
    
    return jsonify({"status": "success"})

@app.route('/quiz/<int:quiz_id>')
def quiz(quiz_id):
    if 'quiz_answers' not in session:
        session['quiz_answers'] = {}
        
    if 'quiz_start_time' not in session:
        session['quiz_start_time'] = time.time()

    # Prevent retakes: only jump forward if BOTH categories are locked
    if str(quiz_id) in session['quiz_answers']:
        ans = session['quiz_answers'][str(quiz_id)]
        if ans.get("shutter_locked") and ans.get("aperture_locked"):
            next_quiz_id = quiz_id + 1
            if str(next_quiz_id) in app_data["quizzes"]:
                return redirect(url_for('quiz', quiz_id=next_quiz_id))
            else:
                return redirect(url_for('result'))

    quiz_data = app_data["quizzes"].get(str(quiz_id))
    if not quiz_data:
        return redirect(url_for('result'))
        
    return render_template('quiz.html', quiz=quiz_data, quiz_id=quiz_id)

@app.route('/submit_quiz', methods=['POST'])
def submit_quiz():
    # 1. Get the data the user just submitted from the dials
    data = request.get_json()
    quiz_id = str(data.get('quiz_id'))
    
    # 2. Force Python to read the freshest version of our answer key
    with open('data.json', 'r') as file:
        app_data = json.load(file)
        
    quiz_info = app_data["quizzes"].get(quiz_id)
    
    # Safety net just in case
    if not quiz_info:
        return jsonify({"error": "Quiz not found"}), 404

    # 3. Grade the user's settings against the answer key in data.json
    user_shutter = data.get('shutter')
    user_aperture = data.get('aperture')
    user_iso = data.get('iso')
    
    shutter_correct = (user_shutter == quiz_info['correct_shutter'])
    aperture_correct = (user_aperture == quiz_info['correct_aperture'])
    iso_correct = (user_iso == quiz_info['correct_iso'])
    
    all_correct = shutter_correct and aperture_correct and iso_correct

    # 4. Calculate where they go next (Next question, or the final results page)
    total_quizzes = len(app_data["quizzes"])
    if int(quiz_id) < total_quizzes:
        next_url = f"/quiz/{int(quiz_id) + 1}"
    else:
        
        next_url = "/result" 

    # 5. Send the verdict back to the JavaScript
    return jsonify({
        "all_correct": all_correct,
        "shutter_feedback": shutter_correct,
        "aperture_feedback": aperture_correct,
        "iso_feedback": iso_correct,
        "next_url": next_url
    })

@app.route('/result')
def result():
    answers = session.get('quiz_answers', {})
    score = sum(ans.get("shutter_score", 0) + ans.get("aperture_score", 0) + ans.get("iso_score", 0) for ans in answers.values())
    total_questions = len(app_data["quizzes"]) * 3 
    
    start_time = session.get('quiz_start_time', time.time())
    elapsed_seconds = int(time.time() - start_time)
    
    # Format time string
    q_mins, q_secs = divmod(elapsed_seconds, 60)
    quiz_time_str = f"{q_mins}m {q_secs}s" if q_mins > 0 else f"{q_secs}s"
    
    # ---------------------------------------------------------
    # NEW: Competitive Tier Grading Logic (Based on 4 questions)
    # ---------------------------------------------------------
    if elapsed_seconds <= 40:     # < 10s per photo
        grade = "S"
        grade_color = "text-warning" # Gold
    elif elapsed_seconds <= 70:   # < 17s per photo
        grade = "A"
        grade_color = "text-success"
    elif elapsed_seconds <= 100:  # < 25s per photo
        grade = "B"
        grade_color = "text-primary"
    elif elapsed_seconds <= 140:  # < 35s per photo
        grade = "C"
        grade_color = "text-info"
    elif elapsed_seconds <= 200:  # < 50s per photo
        grade = "D"
        grade_color = "text-secondary"
    else:
        grade = "F"
        grade_color = "text-danger"
        
    lesson_times_data = []
    if 'lesson_times' in session:
        for lid, seconds in session['lesson_times'].items():
            lesson = app_data["lessons"].get(str(lid))
            if lesson:
                l_mins, l_secs = divmod(int(seconds), 60)
                t_str = f"{l_mins}m {l_secs}s" if l_mins > 0 else f"{l_secs}s"
                lesson_times_data.append({"title": lesson["title"], "time": t_str})
    
    return render_template('result.html', score=score, total=total_questions, time_taken=quiz_time_str, grade=grade, grade_color=grade_color, learning_times=lesson_times_data)

if __name__ == '__main__':
    app.run(debug=True)