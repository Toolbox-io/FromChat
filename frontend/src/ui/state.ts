import { create } from "zustand";

type Page = "login" | "register" | "chat"

interface AppState {
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
}

export const useAppState = create<AppState>((set) => ({
    currentPage: "login", // default page
    setCurrentPage: (page: Page) => set({ currentPage: page })
}));