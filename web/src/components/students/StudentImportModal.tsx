"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";
import { Student } from "@/types/student";

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StudentImportModal({ isOpen, onClose }: StudentImportModalProps) {
  const { addStudents } = useStudentStore();
  const { classes } = useClassStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Omit<Student, "id">[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      await parseExcel(selectedFile);
    }
  };

  const parseExcel = async (file: File) => {
    setIsLoading(true);
    try {
      // Dynamically import xlsx only on client side when needed
      const XLSX = await import("xlsx");
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet);

          const normalizeClass = (rawClass: any) => {
            if (!rawClass) return "";
            // Remove "KELAS" or "CLASS" word if exists and cleanup
            let str = rawClass.toString().toUpperCase()
              .replace(/KELAS|CLASS/g, "")
              .trim();
            
            // Regex to match grade and suffix
            // Supports: 7A, 7-A, VIIA, VII-A, 7 A, VII A, 7.A
            const match = str.match(/^(VIII|VII|IX|7|8|9)(?:\s*[-.]?\s*)([A-Z0-9]+.*)$/);
            
            if (match) {
              let grade = match[1];
              const sub = match[2].trim();
              
              if (grade === "7") grade = "VII";
              if (grade === "8") grade = "VIII";
              if (grade === "9") grade = "IX";
              
              return `${grade}-${sub}`;
            }
            return str;
          };

          const mappedData: Omit<Student, "id">[] = jsonData.map((row: any) => ({
            nisn: row["NISN"]?.toString() || "",
            name: row["Nama"] || "",
            class: normalizeClass(row["Kelas"]),
            gender: row["L/P"] || "L",
            birthPlace: row["Tempat Lahir"] || "",
            birthDate: row["Tanggal Lahir"] || "",
            address: row["Alamat"] || "",
            parentName: row["Nama Orang Tua"] || "",
            phone: row["No HP"]?.toString() || "",
            status: "active" as const,
            email: row["Email"] || "",
          })).filter((s: any) => s.name && s.nisn);

          if (mappedData.length === 0) {
            setError("Tidak ada data valid yang ditemukan dalam file.");
          } else {
            // Check for unknown classes
            const unknownClasses = new Set<string>();
            mappedData.forEach(s => {
              // FIX: Handle potential undefined s.class
              const className = s.class || "";
              const exists = classes.some(c => c.name.toUpperCase() === className.toUpperCase());
              if (!exists) unknownClasses.add(className);
            });

            if (unknownClasses.size > 0) {
              const unknownList = Array.from(unknownClasses).join(", ");
              setError(`PERINGATAN: Kelas berikut tidak ditemukan di sistem: ${unknownList}. Pastikan format sesuai (misal: VII-A) atau tambahkan kelas terlebih dahulu di menu Manajemen Kelas.`);
              // We still allow import, but show warning
              setParsedData(mappedData);
            } else {
              setParsedData(mappedData);
            }
          }
        } catch (err) {
          console.error(err);
          setError("Gagal memproses data Excel.");
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error("Failed to load xlsx", err);
      setError("Gagal memuat library Excel.");
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (parsedData.length > 0) {
      setIsLoading(true);
      setError(null);
      try {
        await addStudents(parsedData);
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setTimeout(() => {
            setFile(null);
            setParsedData([]);
            setSuccess(false);
          }, 300);
        }, 1500);
      } catch (err) {
        console.error(err);
        setError((err as any)?.message ? String((err as any).message) : "Gagal mengimpor data siswa.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const downloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const templateData = [
        {
          "NISN": "0012345678",
          "Nama": "Contoh Siswa",
          "Kelas": "VII-A",
          "L/P": "L",
          "Tempat Lahir": "Mojokerto",
          "Tanggal Lahir": "2010-01-01",
          "Alamat": "Jl. Contoh No. 1",
          "Nama Orang Tua": "Nama Ayah/Ibu",
          "No HP": "08123456789",
          "Email": "siswa@sekolah.sch.id"
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
    } catch (err) {
      console.error("Failed to download template", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Import Data Siswa</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {!success ? (
          <>
            <div className="mb-6">
              <p className="mb-2 text-sm text-gray-600">
                Upload file Excel (.xlsx).
              </p>
              <button 
                onClick={downloadTemplate}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
              >
                Download Template
              </button>
            </div>

            <div 
              className={`relative mb-4 flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                file ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".xlsx, .xls" 
                className="hidden" 
              />
              
              {file ? (
                <div className="flex flex-col items-center text-center">
                  <FileSpreadsheet className="mb-2 h-10 w-10 text-green-600" />
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <Upload className="mb-2 h-10 w-10 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900">Klik untuk upload</p>
                  <p className="text-xs text-gray-500">atau drag & drop file disini</p>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Batal
              </button>
              <button
                onClick={handleImport}
                disabled={!file || parsedData.length === 0 || isLoading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Memproses..." : "Import Data"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 rounded-full bg-green-100 p-3">
              <Upload className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">Import Berhasil!</h3>
            <p className="text-sm text-gray-500">
              {parsedData.length} data siswa telah berhasil ditambahkan ke sistem.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
