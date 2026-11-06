// Mirrors backend/app/schemas/profile.py and cv.py
export interface ExperienceItem {
  title: string;
  company: string;
  start: string;
  end: string;
  summary: string;
}

export interface EducationItem {
  qualification: string;
  institution: string;
  start: string;
  end: string;
  details: string;
}

export interface ProjectItem {
  name: string;
  summary: string;
  link: string;
}

export interface ProfileDetails {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  summary: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
}

export interface Profile extends ProfileDetails {
  has_cv: boolean;
  updated_at: string;
}

export type TextField = Exclude<keyof ProfileDetails, "skills" | ListName>;
export type ListName = "experience" | "education" | "projects";
export type ListItem<L extends ListName> = ProfileDetails[L][number];

export interface Cv {
  id: number;
  label: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  is_default: boolean;
  has_text: boolean;
  created_at: string;
}

export interface CvParseResult {
  cv: Cv;
  details: ProfileDetails;
  parser: "basic" | "ai";
  warnings: string[];
}
