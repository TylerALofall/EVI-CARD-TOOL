import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import json
import csv
import os
from datetime import datetime
import base64
import requests
import speech_recognition as sr
import threading
from pathlib import Path
import hashlib
import stat
import google.generativeai as genai

class EvidenceCardSystem:
    def __init__(self, root):
        self.root = root
        self.root.title("Tyler's Evidence Card Automation System")
        self.root.geometry("1200x800")
        
        # Storage directory
        self.storage_dir = Path.home() / "EvidenceCards"
        self.storage_dir.mkdir(exist_ok=True)
        self.files_dir = self.storage_dir / "files"
        self.files_dir.mkdir(exist_ok=True)
        self.exports_dir = self.storage_dir / "exports"
        self.exports_dir.mkdir(exist_ok=True)
        self.templates_dir = self.storage_dir / "templates"
        self.templates_dir.mkdir(exist_ok=True)
        
        # Variables
        self.uploaded_files = []
        self.generated_cards = []
        self.recognizer = sr.Recognizer()
        self.recording = False
        self.prompt_template = ""
        
        # Load saved API key
        self.api_key_file = self.storage_dir / "api_key.txt"
        self.api_key = self.load_api_key()
        
        # Load prompt template
        self.prompt_file = self.templates_dir / "prompt_revised.txt"
        self.load_prompt_template()
        
        self.verify_integrity_on_startup()
        
        self.setup_ui()
        
    def load_api_key(self):
        """Load saved API key from file"""
        if self.api_key_file.exists():
            return self.api_key_file.read_text().strip()
        return ""
    
    def save_api_key(self):
        """Save API key to file"""
        self.api_key_file.write_text(self.api_key_var.get())
        
    def load_prompt_template(self):
        """Load or create the prompt template"""
        if not self.prompt_file.exists():
            # Create default template with placeholders
            default_template = """You are a legal evidence processor for Tyler Lofall's case.

VOICE TRANSCRIPTION / NOTES:
{{VOICE_INSERT}}

EVIDENCE FILES ATTACHED:
{{FILES_LIST}}

EVIDENCE SCREENSHOTS/PDFS CONTENT:
{{FILES_CONTENT}}

INSTRUCTIONS:
Generate up to 3 evidence cards based on the provided information. Each card must follow this EXACT JSON schema:

{
  "uid": "unique identifier like 334, 1224, etc",
  "location": [{
    "location": "specific location (e.g., Clackamas County Court House)",
    "date_of_event": "YYYY-MM-DD",
    "time_of_event": "HH:MM"
  }],
  "claim": [{
    "clause": "legal claim (e.g., Conspiracy to Violate Civil Rights (42 U.S.C. § 1983))",
    "element": "specific element violated"
  }],
  "parties_involved": [{
    "d1_gunnarson": boolean,
    "d2_blyth": boolean,
    "d3_west_linn": boolean,
    "d4_portlock": boolean,
    "d5_jail": boolean,
    "d6_county": boolean,
    "d7_sheriff": boolean,
    "d8_ccso_doe1": boolean,
    "d9_ccso_doe2": boolean
  }],
  "none_party_players": [{
    "npp_mg": boolean (Massiel Galla),
    "npp_rm": boolean (Ruben Medina),
    "npp_js": boolean (Jail Staff),
    "npp_jud": boolean (Judge Steele)
  }],
  "screenshot_url": "reference to evidence file",
  "description_of_evidence": "clear description of what the evidence is",
  "depiction_quote": "direct impactful quote from the evidence",
  "significance": "explanation of why this evidence is important",
  "precedence": [{
    "caselaw1": "First case law with explanation of similarity",
    "caselaw2": "Second case law with explanation of similarity"
  }],
  "oath_of_auth": "This is a true and accurate copy of a document produced by the opposing party.",
  "notes": "additional context or important points",
  "complements_uid": "other UIDs this evidence complements (e.g., '1224, 244')",
  "citation": "specific citation (e.g., 'Court Transcript, page 5 at par 2-3')",
  "source": "source of document (e.g., 'Court Listener Transcript, Case No. 22CR10908')",
  "state_produced": boolean (true if from state/defendants)
}

KEY PARTIES TO REMEMBER:
- D1: Officer Dana Gunnarson
- D2: Officer Catlin Blyth  
- D3: West Linn Police Dept / City of
- D4: Rebecca Portlock (DDA)
- D5: Clackamas Co. Jail
- D6: Clackamas Co. Sheriff Dept
- D7: Clackamas County
- D8/D9: CCSO John Does

Return ONLY a valid JSON array containing 1-3 evidence card objects. No markdown, no explanation, just the JSON array."""
            
            self.prompt_file.write_text(default_template)
            self.prompt_template = default_template
            
            # Show message to user
            messagebox.showinfo("Template Created", 
                f"Created default prompt template at:\n{self.prompt_file}\n\n"
                "You can edit this file to customize your prompt!")
        else:
            # Load existing template
            self.prompt_template = self.prompt_file.read_text()
        
    def verify_integrity_on_startup(self):
        """Verify ECF_FILES integrity against manifests and ensure baseline exists."""
        try:
            base_dir = Path(__file__).resolve().parent
            integrity_dir = base_dir / "data"
            primary = integrity_dir / "ECF_FILES_manifest.json"
            backup = integrity_dir / "ECF_FILES_manifest.backup.json"
            ecf_dir = base_dir / "ECF_FILES"

            def compute_manifest():
                items = []
                if ecf_dir.exists():
                    for p in ecf_dir.rglob('*'):
                        if p.is_file():
                            h = hashlib.sha256()
                            with open(p, 'rb') as f:
                                for chunk in iter(lambda: f.read(8192), b''):
                                    h.update(chunk)
                            rel = p.relative_to(base_dir).as_posix()
                            items.append({
                                "path": rel,
                                "sha256": h.hexdigest().upper(),
                                "bytes": p.stat().st_size
                            })
                items.sort(key=lambda x: x["path"])
                return items

            def set_readonly(path: Path):
                try:
                    os.chmod(path, stat.S_IREAD)
                except Exception:
                    pass

            integrity_dir.mkdir(exist_ok=True)
            created = False
            if not primary.exists() or not backup.exists():
                manifest = compute_manifest()
                primary.write_text(json.dumps(manifest, indent=2))
                backup.write_text(json.dumps(manifest, indent=2))
                set_readonly(primary)
                set_readonly(backup)
                created = True

            def load_manifest(p: Path):
                try:
                    return json.loads(p.read_text()) if p.exists() else []
                except Exception:
                    return []

            m1 = load_manifest(primary)
            m2 = load_manifest(backup)

            same_baseline = (m1 == m2)
            live = compute_manifest()

            def to_map(man):
                return {e["path"]: (e.get("sha256"), e.get("bytes", 0)) for e in man}

            map1 = to_map(m1)
            map_live = to_map(live)

            added = [p for p in map_live.keys() if p not in map1]
            removed = [p for p in map1.keys() if p not in map_live]
            changed = [p for p in map_live.keys() if p in map1 and map_live[p][0] != map1[p][0]]

            summary = []
            if created:
                summary.append("Created integrity baselines for ECF_FILES.")
            if not same_baseline:
                summary.append("WARNING: Baseline and backup manifest differ.")
            if added or removed or changed:
                summary.append(f"Integrity check: {len(added)} added, {len(removed)} removed, {len(changed)} changed.")
            else:
                summary.append("Integrity check passed for ECF_FILES.")

            try:
                messagebox.showinfo("Integrity", "\n".join(summary))
            except Exception:
                pass

        except Exception as e:
            try:
                messagebox.showwarning("Integrity", f"Integrity verification skipped: {e}")
            except Exception:
                pass

    
    def setup_ui(self):
        """Setup the UI"""
        # Main container
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        
        # TOP BANNER - Template Status
        template_frame = ttk.LabelFrame(main_frame, text="📄 Prompt Template", padding="5")
        template_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        template_label = ttk.Label(template_frame, text=f"Using template: {self.prompt_file.name}")
        template_label.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(template_frame, text="Edit Template", command=self.edit_template).pack(side=tk.LEFT, padx=5)
        ttk.Button(template_frame, text="Reload Template", command=self.reload_template).pack(side=tk.LEFT, padx=5)
        ttk.Button(template_frame, text="Open Templates Folder", command=self.open_templates).pack(side=tk.LEFT, padx=5)
        
        # LEFT PANEL - Input
        left_frame = ttk.LabelFrame(main_frame, text="Input & Recording", padding="10")
        left_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 5))
        
        # Voice recording section
        voice_frame = ttk.LabelFrame(left_frame, text="🎤 Voice Input (→ {{VOICE_INSERT}})", padding="5")
        voice_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.record_btn = ttk.Button(voice_frame, text="Start Recording", command=self.toggle_recording)
        self.record_btn.pack(side=tk.LEFT, padx=5)
        
        self.clear_btn = ttk.Button(voice_frame, text="Clear Text", command=self.clear_text)
        self.clear_btn.pack(side=tk.LEFT, padx=5)
        
        self.recording_label = ttk.Label(voice_frame, text="", foreground="red")
        self.recording_label.pack(side=tk.LEFT, padx=10)
        
        # Transcription text area
        text_frame = ttk.LabelFrame(left_frame, text="📝 Voice Transcription / Manual Notes", padding="5")
        text_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.text_area = scrolledtext.ScrolledText(text_frame, height=10, wrap=tk.WORD)
        self.text_area.pack(fill=tk.BOTH, expand=True)
        
        # Show placeholder info
        placeholder_info = ttk.Label(text_frame, 
            text="This text will replace {{VOICE_INSERT}} in your template", 
            foreground="gray")
        placeholder_info.pack()
        
        # File upload section
        file_frame = ttk.LabelFrame(left_frame, text="📁 Evidence Files (→ {{FILES_LIST}})", padding="5")
        file_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(file_frame, text="Add Files", command=self.add_files).pack(pady=5)
        
        self.file_listbox = tk.Listbox(file_frame, height=5)
        self.file_listbox.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Button(file_frame, text="Remove Selected", command=self.remove_file).pack()
        
        # Process button
        self.process_btn = ttk.Button(left_frame, text="🚀 Process with Gemini", 
                                     command=self.process_with_gemini,
                                     style="Accent.TButton")
        self.process_btn.pack(fill=tk.X, pady=10)
        
        # RIGHT PANEL - Configuration & Output
        right_frame = ttk.LabelFrame(main_frame, text="Configuration & Output", padding="10")
        right_frame.grid(row=1, column=1, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(5, 0))
        
        # API Key section
        api_frame = ttk.LabelFrame(right_frame, text="🔑 Gemini API Settings", padding="5")
        api_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(api_frame, text="API Key:").pack(anchor=tk.W)
        self.api_key_var = tk.StringVar(value=self.api_key)
        api_entry = ttk.Entry(api_frame, textvariable=self.api_key_var, show="*")
        api_entry.pack(fill=tk.X, pady=5)
        ttk.Button(api_frame, text="Save Key", command=self.save_api_key).pack()
        
        # Generated cards display
        cards_frame = ttk.LabelFrame(right_frame, text="📋 Generated Evidence Cards", padding="5")
        cards_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.cards_text = scrolledtext.ScrolledText(cards_frame, height=10, wrap=tk.WORD)
        self.cards_text.pack(fill=tk.BOTH, expand=True)
        
        # Export buttons
        export_frame = ttk.Frame(right_frame)
        export_frame.pack(fill=tk.X)
        
        ttk.Button(export_frame, text="💾 Export JSON", command=self.export_json).pack(side=tk.LEFT, padx=5)
        ttk.Button(export_frame, text="📊 Export CSV", command=self.export_csv).pack(side=tk.LEFT, padx=5)
        ttk.Button(export_frame, text="📂 Open Exports", command=self.open_exports).pack(side=tk.LEFT, padx=5)
        
        # Bottom status bar
        self.status_var = tk.StringVar(value="Ready - Template loaded")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN)
        status_bar.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))
        
    def edit_template(self):
        """Open template file for editing"""
        try:
            os.startfile(self.prompt_file)
            messagebox.showinfo("Edit Template", 
                "Template opened in default text editor.\n\n"
                "Available placeholders:\n"
                "{{VOICE_INSERT}} - Your voice/text input\n"
                "{{FILES_LIST}} - List of uploaded files\n"
                "{{FILES_CONTENT}} - Content from PDFs/images\n\n"
                "Save the file and click 'Reload Template' when done!")
        except Exception as e:
            messagebox.showerror("Error", f"Could not open template: {e}")
            
    def reload_template(self):
        """Reload the prompt template from file"""
        try:
            self.prompt_template = self.prompt_file.read_text()
            self.status_var.set("Template reloaded successfully")
            messagebox.showinfo("Success", "Template reloaded!")
        except Exception as e:
            messagebox.showerror("Error", f"Could not reload template: {e}")
            
    def open_templates(self):
        """Open templates folder"""
        os.startfile(self.templates_dir)
        
    def toggle_recording(self):
        """Toggle voice recording"""
        if not self.recording:
            self.recording = True
            self.record_btn.config(text="Stop Recording")
            self.recording_label.config(text="● Recording...")
            self.status_var.set("Recording audio...")
            
            # Start recording in background thread
            thread = threading.Thread(target=self.record_audio)
            thread.daemon = True
            thread.start()
        else:
            self.recording = False
            self.record_btn.config(text="Start Recording")
            self.recording_label.config(text="")
            self.status_var.set("Recording stopped")
    
    def record_audio(self):
        """Record audio and transcribe"""
        try:
            with sr.Microphone() as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
                
                while self.recording:
                    try:
                        # Listen for audio with timeout
                        audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=5)
                        
                        # Transcribe
                        text = self.recognizer.recognize_google(audio)
                        
                        # Append to text area
                        self.root.after(0, lambda t=text: self.append_transcription(t))
                        
                    except sr.WaitTimeoutError:
                        pass
                    except sr.UnknownValueError:
                        pass
                    except Exception as e:
                        print(f"Recognition error: {e}")
                        
        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("Error", f"Microphone error: {e}"))
    
    def append_transcription(self, text):
        """Append transcribed text to text area"""
        current = self.text_area.get("1.0", tk.END).strip()
        if current:
            self.text_area.insert(tk.END, " " + text)
        else:
            self.text_area.insert(tk.END, text)
        self.text_area.see(tk.END)
    
    def clear_text(self):
        """Clear transcription text"""
        self.text_area.delete("1.0", tk.END)
        
    def add_files(self):
        """Add evidence files - now with prompt template option"""
        files = filedialog.askopenfilenames(
            title="Select Evidence Files or Prompt Template",
            filetypes=[
                ("All Supported", "*.txt *.pdf *.png *.jpg *.jpeg"),
                ("Prompt Template", "*.txt"),
                ("PDF Files", "*.pdf"),
                ("Images", "*.png *.jpg *.jpeg"),
                ("All Files", "*.*")
            ]
        )
        
        for filepath in files:
            file_path = Path(filepath)
            
            # Check if this is a prompt template file
            if file_path.suffix == '.txt' and 'prompt' in file_path.stem.lower():
                # Ask if they want to use this as the template
                if messagebox.askyesno("Prompt Template", 
                    f"Use '{file_path.name}' as your prompt template?"):
                    # Copy to templates directory and load it
                    new_template_path = self.templates_dir / file_path.name
                    new_template_path.write_bytes(file_path.read_bytes())
                    self.prompt_file = new_template_path
                    self.reload_template()
                    continue
            
            # Otherwise treat as evidence file
            file_hash = hashlib.md5(file_path.read_bytes()).hexdigest()[:8]
            stored_name = f"{file_hash}_{file_path.name}"
            stored_path = self.files_dir / stored_name
            
            # Copy file
            stored_path.write_bytes(file_path.read_bytes())
            
            # Add to list
            self.uploaded_files.append({
                'original_path': filepath,
                'stored_path': str(stored_path),
                'name': file_path.name,
                'size': file_path.stat().st_size
            })
            
            self.file_listbox.insert(tk.END, f"{file_path.name} ({self.format_size(file_path.stat().st_size)})")
        
        self.status_var.set(f"Added {len(files)} file(s)")
    
    def remove_file(self):
        """Remove selected file"""
        selection = self.file_listbox.curselection()
        if selection:
            index = selection[0]
            self.file_listbox.delete(index)
            del self.uploaded_files[index]
            self.status_var.set("File removed")
    
    def format_size(self, bytes):
        """Format file size"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes < 1024.0:
                return f"{bytes:.1f} {unit}"
            bytes /= 1024.0
        return f"{bytes:.1f} TB"
    
    def process_with_gemini(self):
        """Process with Gemini API"""
        if not self.api_key_var.get():
            messagebox.showerror("Error", "Please enter your Gemini API key")
            return
        
        transcription = self.text_area.get("1.0", tk.END).strip()
        
        # We can process even without voice if we have files
        if not transcription and not self.uploaded_files:
            if messagebox.askyesno("No Input", 
                "No voice/text or files added. Process anyway with just the template?"):
                transcription = "Process the following legal evidence."
            else:
                return
        
        self.status_var.set("Processing with Gemini AI...")
        self.process_btn.config(state='disabled')
        
        # Process in background thread
        thread = threading.Thread(target=self._process_gemini_thread, args=(transcription,))
        thread.daemon = True
        thread.start()
    
    def _process_gemini_thread(self, transcription):
        """Background thread for Gemini processing"""
        try:
            # Configure Gemini
            genai.configure(api_key=self.api_key_var.get())
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
            
            # Build the prompt with replacements
            prompt = self.build_final_prompt(transcription)
            
            # Prepare files for upload
            file_parts = []
            for file_info in self.uploaded_files:
                file_path = Path(file_info['stored_path'])
                if file_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                    # Upload image files
                    uploaded_file = genai.upload_file(str(file_path))
                    file_parts.append(uploaded_file)
            
            # Generate content
            response = model.generate_content([prompt] + file_parts)
            
            # Parse response
            try:
                response_text = response.text
                # Find JSON array in response
                start_idx = response_text.find('[')
                end_idx = response_text.rfind(']') + 1
                if start_idx != -1 and end_idx > start_idx:
                    json_text = response_text[start_idx:end_idx]
                    self.generated_cards = json.loads(json_text)
                else:
                    # Try to parse entire response as JSON
                    self.generated_cards = json.loads(response_text)
                
                # Update UI
                self.root.after(0, self.display_cards)
                self.root.after(0, lambda: self.status_var.set("Processing complete!"))
                
            except json.JSONDecodeError as e:
                self.root.after(0, lambda: messagebox.showerror("Parse Error", f"Failed to parse AI response: {e}"))
                
        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("Error", f"Processing failed: {e}"))
        finally:
            self.root.after(0, lambda: self.process_btn.config(state='normal'))
    
    def build_final_prompt(self, transcription):
        """Build the final prompt by replacing placeholders"""
        prompt = self.prompt_template
        
        # Replace {{VOICE_INSERT}} with transcription
        if "{{VOICE_INSERT}}" in prompt:
            prompt = prompt.replace("{{VOICE_INSERT}}", transcription or "No voice transcription provided.")
        else:
            # If no placeholder, append at the beginning
            prompt = f"Voice/Text Input: {transcription}\n\n{prompt}"
        
        # Replace {{FILES_LIST}} with file list
        if self.uploaded_files:
            files_list = "\n".join([f"- {f['name']} ({self.format_size(f['size'])})" 
                                   for f in self.uploaded_files])
        else:
            files_list = "No files attached."
        
        if "{{FILES_LIST}}" in prompt:
            prompt = prompt.replace("{{FILES_LIST}}", files_list)
        
        # Replace {{FILES_CONTENT}} placeholder
        files_content = ""
        for file_info in self.uploaded_files:
            file_path = Path(file_info['stored_path'])
            if file_path.suffix.lower() == '.pdf':
                files_content += f"\nPDF: {file_info['name']} (stored at: {file_info['stored_path']})\n"
            elif file_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                files_content += f"\nImage: {file_info['name']} (will be processed visually)\n"
        
        if not files_content:
            files_content = "No file content to process."
            
        if "{{FILES_CONTENT}}" in prompt:
            prompt = prompt.replace("{{FILES_CONTENT}}", files_content)
        
        return prompt
    
    def display_cards(self):
        """Display generated cards"""
        self.cards_text.delete("1.0", tk.END)
        
        for i, card in enumerate(self.generated_cards, 1):
            card_text = f"=== Evidence Card {i} ===\n"
            card_text += f"UID: {card.get('uid', 'N/A')}\n"
            card_text += f"Claim: {card.get('claim', [{}])[0].get('clause', 'N/A')}\n"
            card_text += f"Location: {card.get('location', [{}])[0].get('location', 'N/A')}\n"
            card_text += f"Date: {card.get('location', [{}])[0].get('date_of_event', 'N/A')}\n"
            card_text += f"Description: {card.get('description_of_evidence', 'N/A')}\n"
            card_text += f"Significance: {card.get('significance', 'N/A')}\n"
            card_text += "-" * 50 + "\n\n"
            
            self.cards_text.insert(tk.END, card_text)
    
    def export_json(self):
        """Export cards as JSON"""
        if not self.generated_cards:
            messagebox.showwarning("Warning", "No cards to export")
            return
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = self.exports_dir / f"evidence_cards_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(self.generated_cards, f, indent=2)
        
        self.status_var.set(f"JSON exported to: {filename}")
        messagebox.showinfo("Success", f"JSON exported to:\n{filename}")
    
    def export_csv(self):
        """Export cards as CSV for mail merge"""
        if not self.generated_cards:
            messagebox.showwarning("Warning", "No cards to export")
            return
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = self.exports_dir / f"evidence_cards_mailmerge_{timestamp}.csv"
        
        headers = [
            'UID', 'Location', 'Date', 'Time', 'Claim', 'Element',
            'D1_Gunnarson', 'D2_Blyth', 'D3_WestLinn', 'D4_Portlock',
            'D5_Jail', 'D6_County', 'D7_Sheriff', 'D8_Doe1', 'D9_Doe2',
            'Description', 'Quote', 'Significance', 'Caselaw1', 'Caselaw2',
            'Source', 'Citation', 'Notes', 'Screenshot_Path'
        ]
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for card in self.generated_cards:
                row = [
                    card.get('uid', ''),
                    card.get('location', [{}])[0].get('location', ''),
                    card.get('location', [{}])[0].get('date_of_event', ''),
                    card.get('location', [{}])[0].get('time_of_event', ''),
                    card.get('claim', [{}])[0].get('clause', ''),
                    card.get('claim', [{}])[0].get('element', ''),
                    card.get('parties_involved', [{}])[0].get('d1_gunnarson', False),
                    card.get('parties_involved', [{}])[0].get('d2_blyth', False),
                    card.get('parties_involved', [{}])[0].get('d3_west_linn', False),
                    card.get('parties_involved', [{}])[0].get('d4_portlock', False),
                    card.get('parties_involved', [{}])[0].get('d5_jail', False),
                    card.get('parties_involved', [{}])[0].get('d6_county', False),
                    card.get('parties_involved', [{}])[0].get('d7_sheriff', False),
                    card.get('parties_involved', [{}])[0].get('d8_ccso_doe1', False),
                    card.get('parties_involved', [{}])[0].get('d9_ccso_doe2', False),
                    card.get('description_of_evidence', ''),
                    card.get('depiction_quote', ''),
                    card.get('significance', ''),
                    card.get('precedence', [{}])[0].get('caselaw1', ''),
                    card.get('precedence', [{}])[0].get('caselaw2', ''),
                    card.get('source', ''),
                    card.get('citation', ''),
                    card.get('notes', ''),
                    card.get('screenshot_url', '')
                ]
                writer.writerow(row)
        
        self.status_var.set(f"CSV exported to: {filename}")
        messagebox.showinfo("Success", f"CSV exported for mail merge to:\n{filename}")
    
    def open_exports(self):
        """Open exports folder"""
        os.startfile(self.exports_dir)

def main():
    root = tk.Tk()
    app = EvidenceCardSystem(root)
    root.mainloop()

if __name__ == "__main__":
    main()

# Save this file as: evidence_cards.py