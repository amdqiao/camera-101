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
    
    # Check if they can take the quiz
    total_lessons = len(app_data["lessons"])
    all_visited = len(session['visited_lessons']) >= total_lessons
    
    return render_template('select.html', all_visited=all_visited)

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

@app.route('/process_drop', methods=['POST'])
def process_drop():
    data = request.get_json()
    quiz_id = str(data['quiz_id'])
    dropped_item = data['dropped_item']
    
    quiz_info = app_data["quizzes"][quiz_id]
    
    # Determine which category the user just dropped
    category = "aperture" if "f/" in dropped_item else "shutter"
    is_correct = False
    
    # Validate against the correct category answer
    if category == "aperture" and dropped_item == quiz_info["correct_aperture"]:
        is_correct = True
    elif category == "shutter" and dropped_item == quiz_info["correct_shutter"]:
        is_correct = True
        
    answers = session.get('quiz_answers', {})
    
    # Initialize the score tracking for this specific question if it's their first drop
    if quiz_id not in answers:
        answers[quiz_id] = {
            "shutter_score": 0, "aperture_score": 0, 
            "shutter_locked": False, "aperture_locked": False
        }
    
    # Failsafe: Ignore if they somehow drop an item for an already locked category
    if answers[quiz_id][f"{category}_locked"]:
        return jsonify({"status": "locked"})
        
    # Lock the category and assign the point
    answers[quiz_id][f"{category}_locked"] = True
    answers[quiz_id][f"{category}_score"] = 1 if is_correct else 0
    session['quiz_answers'] = answers
    
    # Check if they have answered BOTH parts of the question
    question_complete = answers[quiz_id]["shutter_locked"] and answers[quiz_id]["aperture_locked"]
    both_correct = (answers[quiz_id]["shutter_score"] == 1 and answers[quiz_id]["aperture_score"] == 1)
    
    next_quiz_id = int(quiz_id) + 1
    has_next = str(next_quiz_id) in app_data["quizzes"]
    next_url = url_for('quiz', quiz_id=next_quiz_id) if has_next else url_for('result')
    success_image_url = url_for('static', filename=f'images/{quiz_info["target_image"]}')
    
    return jsonify({
        "is_correct": is_correct,
        "category": category,
        "question_complete": question_complete,
        "both_correct": both_correct,
        "success_image": success_image_url, 
        "next_url": next_url
    })

@app.route('/result')
def result():
    answers = session.get('quiz_answers', {})
    
    # Calculate score by summing both category scores across all questions
    score = sum(ans.get("shutter_score", 0) + ans.get("aperture_score", 0) for ans in answers.values())
    total_questions = len(app_data["quizzes"]) * 2
    
    # Calculate Time
    start_time = session.get('quiz_start_time', time.time())
    elapsed_seconds = int(time.time() - start_time)
    q_mins, q_secs = divmod(elapsed_seconds, 60)
    quiz_time_str = f"{q_mins}m {q_secs}s" if q_mins > 0 else f"{q_secs}s"
    
    lesson_times_data = []
    if 'lesson_times' in session:
        for lid, seconds in session['lesson_times'].items():
            lesson = app_data["lessons"].get(str(lid))
            if lesson:
                l_mins, l_secs = divmod(int(seconds), 60)
                t_str = f"{l_mins}m {l_secs}s" if l_mins > 0 else f"{l_secs}s"
                lesson_times_data.append({"title": lesson["title"], "time": t_str})
    
    return render_template('result.html', score=score, total=total_questions, time_taken=quiz_time_str, learning_times=lesson_times_data)

if __name__ == '__main__':
    app.run(debug=True)