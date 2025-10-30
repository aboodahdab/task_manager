from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, request, jsonify, make_response, redirect, render_template
import pymongo
import secrets
from dotenv import load_dotenv
import os
from authlib.integrations.flask_client import OAuth
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from datetime import datetime, timedelta

app = Flask(__name__, template_folder="../front-end/templates",
            static_folder="../front-end/static")
load_dotenv()
app.secret_key = os.getenv("SECRET_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Initialize MongoDB client
myclient = pymongo.MongoClient("mongodb://localhost:27017/")
mydb = myclient["task_manger"]
mycol = mydb["accounts"]

# Initialize OAuth for Google login
oauth = OAuth(app)
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
google = oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    access_token_url='https://oauth2.googleapis.com/token',
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    api_base_url='https://www.googleapis.com/oauth2/v2/',
    userinfo_endpoint='https://www.googleapis.com/oauth2/v2/userinfo',
    client_kwargs={'scope': 'openid email profile'},
)


def translateTime(str_date):

    today = datetime.now()
    start_date = None
    end_date = None
    str_date = str_date.strip().lower()
    if str_date == "today":
        start_date = datetime(today.year, today.month, today.day)
        end_date = start_date+timedelta(days=1)
    elif str_date == "this_week":
        start_date = today-timedelta(days=today.weekday())
        start_date = datetime(
            start_date.year, start_date.month, start_date.day)
        end_date = start_date + timedelta(days=7)
    elif str_date == "next_week":
        start_date = today - \
            timedelta(days=today.weekday()) + timedelta(days=7)
        end_date = start_date + timedelta(days=7)
    elif str_date == "this_month":
        start_date = datetime(today.year, today.month, 1)
        if today.month == 12:
            end_date = datetime(today.year+1, 1, 1)
        else:
            end_date = datetime(today.year, today.month+1, 1)
    if str_date == "overdue":
        start_date = None
        end_date = today
    return start_date, end_date


@app.route("/")
def homepage():
    # If user is not logged in, redirect to login page
    token = request.cookies.get("session_token")
    if not token or not mycol.find_one({"sessions": token}):
        return redirect("/login")  # Redirect to login if not authenticated
    # If logged in, render the homepage
    return render_template("homepage.html", file="homepage.js")


@app.route("/google-callback", methods=["GET", "POST"])
def google_callback():

    if request.method == "GET":

        return redirect("/login")
    token = (
        request.form.get("credential") or
        (request.json and request.json.get("credential"))
    )
    if not token:
        return "Missing credential", 400
    try:
        idinfo = id_token.verify_oauth2_token(
            token, grequests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo["email"]

        # Check if account exists, if not, create it
        key_hex = secrets.token_hex(32)
        if not mycol.find_one({"email": email}):
            mycol.insert_one({
                "email": email,
                "password": None,  # No password for Google accounts
                "google": True,
                "sessions": [key_hex]
            })
        else:
            mycol.update_one(
                {"email": email},
                {"$addToSet": {"sessions": key_hex}}
            )

        resp = make_response(
            jsonify({"status": "success", "message": "Google login successful"}),)

        resp.set_cookie("session_token", key_hex, httponly=True,
                        max_age=60*60*24*7*3)

        return resp
    except Exception as e:
        print("Google token verify failed:", e)
        return "Invalid token", 400


@app.route("/create-account", methods=["GET", "POST"])
def new_account():
    # If user is already logged in, redirect to homepage
    token = request.cookies.get("session_token")
    if token and mycol.find_one({"sessions": token}):
        return redirect("/")

    if request.method == "POST":
        if request.is_json:
            data = request.get_json()
            email = data.get("email", "").strip().lower()
            password = data.get("password", "").strip()

            if mycol.find_one({"email": email}):
                return jsonify({"status": "fail", "message": "Account already exists"}), 409

            # password hashing
            hashed_password = generate_password_hash(password)
            resp = make_response(
                jsonify({"status": "success", "message": "Account created"}), 201)
            key_hex = secrets.token_hex(32)
            resp.set_cookie("session_token", key_hex, httponly=True,
                            max_age=60*60*24*7*3)
            mycol.insert_one({
                "email": email,
                "password": hashed_password,
                "google": False,
                "sessions": [key_hex]
            })

            return resp
        else:
            return jsonify({"status": "fail", "message": "Expected JSON"}), 415

    # Render the account creation page
    return render_template("createNewAccount.html", file="account.js", google_client_id=GOOGLE_CLIENT_ID)


@app.route("/task", methods=["POST"])
def add_task():
    accounts_col = mydb["accounts"]
    tasks_col = mydb["tasks"]
    if not request.is_json:
        # Unsupported Media Type
        return jsonify({"status": "fail", "message": "Expected JSON"}), 415
    token = request.cookies.get("session_token")
    if token and accounts_col.find_one({"sessions": token}):

        data = request.get_json()
        task_name = data.get("task_name")
        task_date = data.get("task_date")
        task_status = data.get("task_status")

        # Validate input
        if not task_name or not task_date or not task_status:
            # Bad Request
            return jsonify({"status": "fail", "message": "Missing required fields"}), 400

        try:

            task_date = datetime.fromisoformat(task_date)
            user = accounts_col.find_one({"sessions": token})
            task = {"name": task_name, "date": task_date,
                    "status": task_status,    "user_email": user["email"], }

            result = tasks_col.insert_one(task)
            task["_id"] = str(result.inserted_id)  # ✅ include the MongoDB _id

            return jsonify({
                "status": "success",
                "message": "Task added successfully",
                # no need for [task] (array) unless you're returning multiple
                "task": task
            }), 200
        except Exception as e:
            print("Database error:", e)
            # Internal Server Error
            return jsonify({"status": "fail", "message": "Server error"}), 500
    return jsonify({"status": "fail", "message": "Server error"}), 400


@app.route("/deltask", methods=["POST"])
def delTask():
    if not request.is_json:
        return jsonify({"status": "fail", "message": "Expected JSON"}), 415
    try:
        data = request.get_json()
        task_id = data.get("task_id", "")
        if not task_id:
            return jsonify({"status": "fail", "message": "No task ID provided"}), 400

        mycol = mydb["tasks"]
        result = mycol.delete_one({"_id": ObjectId(task_id)})
        if result.deleted_count == 1:
            return jsonify({"status": "success", "message": "Task deleted successfully"}), 200
        else:
            return jsonify({"status": "fail", "message": "Task not found"}), 404
    except Exception as e:
        print("error ", e)
        return jsonify({"status": "fail", "message": "Server error"}), 500


@app.route("/gettask", methods=["GET"])
def get_tasks():
    if request.method == "GET":
        try:
            mycol = mydb["tasks"]
            accounts_col = mydb["accounts"]
            token = request.cookies.get("session_token")
            user = accounts_col.find_one({"sessions": token})

            if token and user:
                user_email = user["email"]
                tasks = list(mycol.find({"user_email": user_email}))

                if not tasks:
                    return jsonify({"status": "fail", "message": "no tasks found"}), 404
                for task in tasks:
                    task["_id"] = str(task["_id"])

                return jsonify({"status": "success", "tasks": tasks}), 200
        except Exception as e:
            print("Database error:", e)
            return jsonify({"status": "fail", "message": "Server error"}), 500
    return jsonify({"status": "fail", "message": "failed to load"}), 400


@app.route("/edittask", methods=["POST"])
def edit_task():
    if not request.is_json:
        return jsonify({"status": "fail", "message": "Expected JSON"}), 415
    try:
        print("i am here")
        data = request.get_json()
        task_id = data.get("task_id", "")
        task_new_name = data.get("task_name", "")
        task_new_status = data.get("task_status", "")
        task_new_date = data.get("task_date", "")
        my_query = {"_id": ObjectId(task_id)}  # <-- FIXED
        new_values = {"$set": {"name": task_new_name,
                               "date": task_new_date, "status": task_new_status}}
        print(new_values, "kk")
        mycol = mydb["tasks"]
        if not task_id or len(task_id) != 24:
            return jsonify({"status": "fail", "message": "Invalid or missing task_id"}), 400

        result = mycol.update_one(my_query, new_values)
        if result.modified_count == 1:
            return jsonify({"status": "success", "message": "Task updated successfully"}), 200
        else:
            return jsonify({"status": "fail", "message": "Task not found or not changed"}), 404
    except Exception as e:
        print("error ", e)
        return jsonify({"status": "fail", "message": "Server error"}), 500


@app.route("/getFilterdTask", methods=["POST"])
def get_filterd_tasks():

    if not request.is_json:
        return jsonify({"status": "fail", "message": "Expected JSON"}), 415
    try:
        data = request.get_json()
        task_name = data.get("task_searched_name", "").strip().lower()
        task_date = data.get("task_searched_date", "").strip().lower()
        task_status = data.get("task_searched_status", "").strip().lower()
        my_col = mydb["tasks"]
        print("data", task_name, "baat", task_date, "cat", task_status)
        start_date, end_date = translateTime(task_date)
        my_query = {}

        if task_name:
            my_query["name"] = {"$regex": task_name, "$options": "i"}
        if task_status:
            my_query["status"] = task_status
        if start_date and end_date:

            my_query["date"] = {"$gte": start_date, "$lt": end_date}
        elif not start_date and end_date:
            my_query["date"] = {"$lt": end_date}
            print("you guys ", start_date, end_date)
        tasks_found = list(my_col.find(my_query).sort("date", 1))

        print(tasks_found)
        for t in tasks_found:
            t["_id"] = str(t["_id"])
        if tasks_found:
            return jsonify({"status": "success", "message": "tasks found", "tasks": tasks_found}), 200
        return jsonify({"status": "fail", "message": "no tasks found "}), 404
    except Exception as e:
        print("error ", e)
        return jsonify({"status": "fail", "message": "Server error"}), 500


@app.route("/login", methods=["GET", "POST"])
def login():
    # If user already has a valid session cookie
    token = request.cookies.get("session_token")
    if token and mycol.find_one({"sessions": token}):
        return redirect("/")

    if request.method == "POST":
        if request.is_json:
            data = request.get_json()
            email = data.get("email", "").strip().lower()
            password = data.get("password", "").strip()

            account = mycol.find_one({"email": email})

            # ✅ Check if the account exists and password is correct
            if account and account.get("password") and check_password_hash(account["password"], password):
                # Generate new session token
                key_hex = secrets.token_hex(32)

                # Add token to user's sessions array
                mycol.update_one(
                    {"email": email},
                    {"$addToSet": {"sessions": key_hex}}
                )

                # Set cookie
                resp = make_response(jsonify({
                    "status": "success",
                    "message": "Login successful"
                }))
                resp.set_cookie(
                    "session_token",
                    key_hex,
                    httponly=True,
                    max_age=60*60*24*7*3,  # 3 weeks

                )
                return resp

            elif account and account.get("google"):
                return jsonify({
                    "status": "fail",
                    "message": "Please use Google login for this account"
                }), 401

            else:
                return jsonify({
                    "status": "fail",
                    "message": "Invalid credentials"
                }), 401

        else:
            return jsonify({
                "status": "fail",
                "message": "Expected JSON"
            }), 415

    # Render the login page
    return render_template("login.html", file="login.js", google_client_id=GOOGLE_CLIENT_ID)


if __name__ == "__main__":
    app.run(debug=True, port=8000)
