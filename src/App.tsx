// App.tsx
// React + TypeScript app for seating allocation
// - Uses Tailwind CSS and shadcn/ui 
// - Requires `xlsx` for parsing/writing Excel files


import mjhs from "@/assets/mjhs.png";

import React, { useEffect, useMemo, useRef, useState } from "react";

import * as XLSX from "xlsx";

// shadcn components (adjust imports to your project setup)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Types
type Student = {
  id: string;
  name: string;
  class: string;
};

type Bench = {
  room: string;
  benchNo: number;
  students: (Student | null)[]; // up to studentsPerBench
};

export default function App() {
  // --- Authentication (simple local mock) ---
  const [user, setUser] = useState<string | null>(() =>
    localStorage.getItem("sp_user")
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // --- File & students ---
  const [students, setStudents] = useState<Student[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // --- Seating config ---
  const [studentsPerBench, setStudentsPerBench] = useState<number>(3);
  const [rooms, setRooms] = useState<{ name: string; benches: number }[]>([
    { name: "Room-1", benches: 0 },
    { name: "Room-2", benches: 0 },
    { name: "Room-3", benches: 0 },
  ]);

  //generate loading animation
  async function handleGenerate() {
    setLoading(true);
    await new Promise((res) => setTimeout(res, 800)); // optional delay
    generateSeating();
    setLoading(false);
  }

  // Generated benches
  const [benches, setBenches] = useState<Bench[]>([]);

  // --- utility to parse uploaded file ---
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      const workbook = XLSX.read(data, { type: "array" });
      // assume first sheet
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any>(sheet, { header: 0 });
      // Expect columns: Name, ID, Class OR variations; normalize
      const parsed: Student[] = raw
        .map((row: any) => {
          // try several possible column names
          const id = (
            row.ID ??
            row.Id ??
            row.id ??
            row["Student ID"] ??
            row["Id"] ??
            ""
          )
            .toString()
            .trim();
          const name = (
            row.Name ??
            row.name ??
            row["Student Name"] ??
            row["Student"] ??
            ""
          )
            .toString()
            .trim();
          const cls = (
            row.Class ??
            row.class ??
            row.ClassName ??
            row["class"] ??
            ""
          )
            .toString()
            .trim();
          if (!id && !name) return null;
          return { id, name, class: cls } as Student;
        })
        .filter(Boolean) as Student[];

      setStudents(parsed);
    };
    reader.readAsArrayBuffer(f);
  }

  // --- seating algorithm ---
  // We'll create bench slots and fill them trying to avoid duplicate classes on the same bench.
  function generateSeating() {
    const totalBenches = rooms.reduce((s, r) => s + r.benches, 0);
    const totalSeats = totalBenches * studentsPerBench;
    const pool = students.slice(0, totalSeats).slice(); // copy

    // We'll attempt to mix classes: for each bench, pick up to studentsPerBench students where each has distinct class if possible
    const benchesOut: Bench[] = [];

    // shuffle pool to randomize
    const shuffled = pool.sort(() => Math.random() - 0.5);

    let pointer = 0; // simple pointer fallback

    for (const r of rooms) {
      for (let b = 1; b <= r.benches; b++) {
        const selected: (Student | null)[] = [];
        const usedClasses = new Set<string>();

        for (let s = 0; s < studentsPerBench; s++) {
          // try to find a student not used whose class not in usedClasses
          let idx = -1;
          for (let i = 0; i < shuffled.length; i++) {
            const candidate = shuffled[i];
            if (!candidate) continue;
            const cls = (candidate.class || "").toLowerCase();
            if (!usedClasses.has(cls)) {
              idx = i;
              break;
            }
          }

          if (idx === -1) {
            // fallback: take next available student
            if (shuffled.length === 0) {
              selected.push(null);
            } else {
              selected.push(shuffled.shift() || null);
            }
          } else {
            const st = shuffled.splice(idx, 1)[0];
            selected.push(st || null);
            if (st) usedClasses.add((st.class || "").toLowerCase());
          }
        }

        benchesOut.push({ room: r.name, benchNo: b, students: selected });
      }
    }

    setBenches(benchesOut);
  }

  // --- allow manual swap: pick student from pool and set to bench seat ---
  function setBenchStudent(
    benchIndex: number,
    seatIndex: number,
    student: Student | null
  ) {
    setBenches((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as Bench[];
      copy[benchIndex].students[seatIndex] = student;
      return copy;
    });
  }

  // make a flattened list of remaining students not assigned
  const assignedIds = useMemo(
    () =>
      new Set(
        benches.flatMap((b) =>
          b.students.filter(Boolean).map((s) => (s as Student).id)
        )
      ),
    [benches]
  );
  const unassignedStudents = students.filter((s) => !assignedIds.has(s.id));

  // export seating to Excel
  function downloadExcel() {
    // create sheet with bench rows
    const rows: any[] = [];
    for (const b of benches) {
      const row: any = { Room: b.room, Bench: b.benchNo };
      b.students.forEach((st, i) => {
        row[`Std ${i + 1} ID`] = st?.id ?? "";
        row[`${i + 1} Name`] = st?.name ?? "";
        row[` ${i + 1} Class`] = st?.class ?? "";
      });
      rows.push(row);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Seating Plan");
    // also add students sheets
    const ws2 = XLSX.utils.json_to_sheet(students);
    XLSX.utils.book_append_sheet(wb, ws2, "Students");
    XLSX.writeFile(wb, "seating_plan.xlsx");
  }

  // --- UI ---
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  // extremely simple mock auth
                  if (!username) return alert("Enter username");
                  localStorage.setItem("sp_user", username);
                  setUser(username);
                }}
              >
                Sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-700 to-purple-900 bg-clip-text text-transparent drop-shadow-sm text-[clamp(1rem,2.6vw,2.2rem)] md:text-[clamp(1.2rem,2.2vw,2.6rem)]">
          MILAN JUNIOR HIGH SCHOOL (Seating Planner)
        </h1>
        <div className="flex gap-4 items-center">
          <div className="text-sm text-slate-600">Hello {user}</div>
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.removeItem("sp_user");
              setUser(null);
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              Upload Students Data in Excel or CSV File (Name, ID, Class)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className=" w-full text-sm text-center text-slate-900 bg-slate-50 border border-slate-300 hover:border-slate-400 
             shadow-sm hover:bg-sky-200 h-10"
            />
            {fileName && (
              <div className="text-sm">
                Loaded: {fileName} — {students.length} students
              </div>
            )}
            <div className="text-xs text-slate-500">
              Your file must contain columns: Name, ID, Class
              (case-insensitive).
            </div>
            <div>
              <h1 className="mt-10 flex justify-center w-full text-lg font-medium text-white-100 bg-purple-100">
                Upload Your File Here 👆
              </h1>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seating Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Students per bench</Label>
              <Select onValueChange={(v) => setStudentsPerBench(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={String(studentsPerBench)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Rooms configuration</Label>
              <div className="space-y-2 mt-2">
                {rooms.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={r.name}
                      onChange={(e) =>
                        setRooms((prev) =>
                          prev.map((room, idx) =>
                            idx === i ? { ...room, name: e.target.value } : room
                          )
                        )
                      }
                      aria-label={`Room name ${i + 1}`}
                    />

                    <Input
                      type="number"
                      value={String(r.benches)}
                      min={0}
                      onChange={(e) => {
                        // keep controlled input safe: convert to int, ensure non-negative
                        const v = e.target.value;
                        // allow empty string while typing, but normalize to 0 if empty or invalid
                        const parsed = v === "" ? 0 : parseInt(v, 10);
                        const benches = Number.isFinite(parsed)
                          ? Math.max(0, parsed)
                          : 0;
                        setRooms((prev) =>
                          prev.map((room, idx) =>
                            idx === i ? { ...room, benches } : room
                          )
                        );
                      }}
                      className="w-24"
                      aria-label={`Benches for ${r.name}`}
                    />

                    <Button
                      variant="destructive"
                      onClick={() =>
                        setRooms((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      setRooms((prev) => [
                        ...prev,
                        { name: `Room-${prev.length + 1}`, benches: 0 },
                      ])
                    }
                  >
                    Add New Room
                  </Button>

                  <Button
                    onClick={() => {
                      // reset to default
                      setRooms([
                        { name: "Room-1", benches: 0 },
                        { name: "Room-2", benches: 0 },
                        { name: "Room-3", benches: 0 },
                      ]);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                onClick={handleGenerate}
                disabled={students.length === 0 || loading}
                className="flex items-center gap-2"
              >
                {loading && (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                )}
                {loading ? "Generating..." : "Generate Seating"}
              </Button>

              <Button onClick={downloadExcel} disabled={benches.length === 0}>
                Download Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* school photo and text */}
        {/* <Card className="m-4 flex items-center">
          <div className="relative overflow-hidden w-80 h-80 m-4 rounded-xl justify-center w-full flex ">
            <img
              src={mjhs}
              alt="Example"
              className="w-full h-full object-cover "
            />

            <div
              className="
    absolute inset-0 
    bg-gradient-to-r from-transparent via-white/50 to-transparent
    translate-x-[-90%]
    hover:translate-x-[100%]
    transition-transform duration-1000
  "
            ></div>
          </div>

          <h3 className="m-4 text-lg font-medium text-slate-700 leading-relaxed">
            This platform provides streamlined seating generation, customizable
            room layouts, and automated student allocation. We thank the school
            administration for encouraging the implementation of this modern
            solution.
          </h3>
        </Card> */}
        <Card className="m-4 items-center gap-4 p-4">
          {/* image wrapper: keeps size fixed and prevents shrinking */}
          <div className="group relative overflow-hidden rounded-xl">
            <img
              src={mjhs}
              alt="School"
              className="w-full h-full sm:w-64 sm:h-64 md:w-80 md:h-80 object-cover transition-transform duration-300 group-hover:scale-115"
            />

            {/* subtle sliding shine - hidden on very small screens */}
            <div className="hidden sm:block absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="absolute left-[-120%] top-0 w-1/2 h-full
                   bg-gradient-to-r from-transparent via-white/30 to-transparent
                   transform transition-transform duration-1000
                   group-hover:translate-x-[240%]"
              />
            </div>
          </div>

          <h3 className="m-4 text-lg font-medium text-slate-700 leading-relaxed">
            This platform provides streamlined seating generation, customizable
            room layouts, and automated student allocation. We thank the school
            administration for encouraging the implementation of this modern
            solution.
          </h3>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Seating Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="p-2 border">Room</th>
                    <th className="p-2 border">Bench</th>
                    {Array.from({ length: studentsPerBench }).map((_, i) => (
                      <th key={i} className="p-2 border">
                        Student {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {benches.map((b, bi) => (
                    <tr key={bi} className="align-top">
                      <td className="p-2 border">{b.room}</td>
                      <td className="p-2 border">{b.benchNo}</td>
                      {b.students.map((s, si) => (
                        <td key={si} className="p-2 border">
                          <div className="text-sm font-medium">
                            {s?.name ?? "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {s?.id ?? ""} {s?.class ? `• ${s.class}` : ""}
                          </div>

                          <div className="mt-2 flex gap-1">
                            <Select
                              onValueChange={(val) => {
                                if (val === "__null__")
                                  return setBenchStudent(bi, si, null);
                                const st = students.find(
                                  (x) => x.id === val
                                ) as Student | undefined;
                                if (st) setBenchStudent(bi, si, st as Student);
                              }}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Change student" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__null__">
                                  — Empty —
                                </SelectItem>
                                {unassignedStudents
                                  .concat(
                                    b.students.filter(Boolean) as Student[]
                                  )
                                  .map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                      {u.name} — {u.id} — {u.class}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center justify-center py-4">
        <h5 className="text-center text-sm md:text-base text-slate-500">
          © Developed & Designed by{" "}
          <span className="font-semibold text-purple-600">
            Zeeshan Khan Alvi
          </span>{" "}
          — 2025
        </h5>
      </div>
    </div>
  );
}
