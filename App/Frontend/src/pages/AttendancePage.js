import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AttendancePage = () => {
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: '',
    student_id: '',
    face_description: '',
    enrolled_courses: ''
  });

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [attendanceRes, studentsRes] = await Promise.all([
        axios.get(`${API}/attendance?date=${selectedDate}`),
        axios.get(`${API}/students`)
      ]);
      setAttendance(attendanceRes.data);
      setStudents(studentsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const addStudent = async () => {
    try {
      await axios.post(`${API}/students`, {
        ...newStudent,
        enrolled_courses: newStudent.enrolled_courses.split(',').map(c => c.trim())
      });
      
      toast.success('Student registered successfully');
      setShowAddStudent(false);
      setNewStudent({ name: '', student_id: '', face_description: '', enrolled_courses: '' });
      loadData();
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error('Failed to register student');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="attendance-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Attendance Tracking
          </h1>
          <p className="text-muted-foreground mt-2">AI-powered facial recognition attendance</p>
        </div>

        <div className="flex gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => setShowAddStudent(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors duration-200 text-sm font-medium shadow-sm"
          >
            Register Student
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Total Records
          </p>
          <p className="text-4xl font-mono-data font-bold">{attendance.length}</p>
        </div>

        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Total Students
          </p>
          <p className="text-4xl font-mono-data font-bold">{students.length}</p>
        </div>

        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Faces Detected Today
          </p>
          <p className="text-4xl font-mono-data font-bold">
            {attendance.reduce((sum, a) => sum + a.detected_faces, 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Attendance Records */}
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Attendance Records
          </h2>

          {attendance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p>No attendance records for this date</p>
            </div>
          ) : (
            <div className="space-y-4">
              {attendance.map((record, index) => (
                <div key={index} className="p-4 bg-background rounded-md border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold">{record.room_name}</h3>
                    <span className="text-sm text-muted-foreground">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Faces Detected:</span>
                      <span className="ml-2 font-mono-data font-bold">{record.detected_faces}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Identified:</span>
                      <span className="ml-2 font-mono-data font-bold">{record.identified_students.length}</span>
                    </div>
                  </div>
                  {record.identified_students.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Students:</p>
                      <div className="flex flex-wrap gap-1">
                        {record.identified_students.map((name, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registered Students */}
        <div className="bg-card p-6 rounded-md border border-border shadow-sm">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Registered Students
          </h2>

          {students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No students registered yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {students.map((student) => (
                <div key={student.id} className="p-4 bg-background rounded-md border border-border">
                  <h3 className="font-bold">{student.name}</h3>
                  <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
                  {student.enrolled_courses.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Courses:</p>
                      <div className="flex flex-wrap gap-1">
                        {student.enrolled_courses.map((course, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded">
                            {course}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-md border border-border shadow-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Register Student
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Student ID</label>
                <input
                  type="text"
                  value={newStudent.student_id}
                  onChange={(e) => setNewStudent({...newStudent, student_id: e.target.value})}
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Enrolled Courses (comma-separated)</label>
                <input
                  type="text"
                  value={newStudent.enrolled_courses}
                  onChange={(e) => setNewStudent({...newStudent, enrolled_courses: e.target.value})}
                  placeholder="e.g., Room 301, Room 405"
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Face Description (optional)</label>
                <textarea
                  value={newStudent.face_description}
                  onChange={(e) => setNewStudent({...newStudent, face_description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={addStudent}
                  disabled={!newStudent.name || !newStudent.student_id}
                  className="flex-1 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200"
                >
                  Register
                </button>
                <button
                  onClick={() => setShowAddStudent(false)}
                  className="flex-1 bg-secondary text-secondary-foreground px-6 py-3 rounded-md font-medium hover:bg-secondary/80 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
