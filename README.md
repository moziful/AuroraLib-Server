# AuroraLib - Ebook Sharing Platform

## 📖 Purpose
AuroraLib is a digital platform that connects ebook lovers, readers, and collectors with talented writers. The platform democratizes access to literature by allowing users to seamlessly browse, discover, and purchase original ebooks. Writers have the tools to upload and manage their creations, while an admin oversees the entire system.

## 🚀 Live Site
- [Live Demo](https://auroralib.vercel.app/)

## 🔗 GitHub Repositories
- **Frontend (Next.js):** [AuroraLib](https://github.com/moziful/AuroraLib)
- **Backend (Express.js):** [AuroraLib-Server](https://github.com/moziful/AuroraLib-Server)

## ✨ Key Features
- **Role-Based Access Control:** Distinct dashboards and permissions for Users (Readers), Writers, and Admins.
- **Authentication:** Secure JWT-based email/password login and Google OAuth integration via BetterAuth.
- **Ebook Marketplace:** Browse, search, filter (by genre, price, availability), and sort ebooks seamlessly.
- **Secure Payments:** Integrated with Stripe for secure ebook purchasing.
- **Writer Dashboard:** Upload covers (via ImgBB), manage ebooks, track sales history, and publish/unpublish content.
- **Admin Management:** Comprehensive oversight of users, all ebooks, transactions, and platform analytics (revenue, sales charts).
- **Bookmarks/Wishlist:** Users can bookmark their favorite ebooks for future reading or purchase.
- **Modern UI/UX:** Fully responsive design built with Next.js, featuring dark mode, animations (Framer Motion), and toast notifications.

## 📦 Tech Stack & Packages
- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **Authentication:** Better-Auth (`@better-auth/mongo-adapter`)
- **Payments:** Stripe (`@stripe/stripe-js`, `stripe`)
- **UI Components:** Framer Motion (Animations), Lucide React & React Icons, Recharts (Analytics Charts)
- **Utilities:** React Toastify, Next-Themes (Dark Mode)
- **Backend:** Node.js, Express.js, MongoDB, JWT (JSON Web Tokens), Multer
