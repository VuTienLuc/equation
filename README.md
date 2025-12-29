# 📘 MathDoc AI Converter

Công cụ chuyên nghiệp giúp chuyển đổi tài liệu Toán học (LaTeX, Word, PDF, Ảnh) sang định dạng Word (.docx) với công thức có thể chỉnh sửa, hỗ trợ bởi Gemini AI.

**Tác giả:** Thầy Vũ Tiến Lực - Trường THPT Nguyễn Hữu Cảnh

## ✨ Tính năng chính
- 📝 **Soạn thảo LaTeX trực tiếp**: Xem trước kết quả tức thì (Live Preview).
- 📸 **Smart OCR (Gemini Vision)**: Nhận diện công thức toán từ ảnh và PDF với độ chính xác cao.
- 📄 **Đa dạng mẫu xuất**: Hỗ trợ xuất file Word theo nhiều form (Đề thi 2 cột, Phiếu bài tập, Cornell notes, Flashcards...).
- 🤖 **AI Assistant**: Tích hợp Chatbot hỗ trợ sửa lỗi mã LaTeX và giải toán.

## 🚀 Hướng dẫn Triển khai (Deployment)

### 1. Đưa dự án lên GitHub
1. Mở terminal tại thư mục dự án.
2. Khởi tạo git:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: MathDoc AI Converter"
   ```
3. Tạo một Repository mới trên GitHub (ví dụ: `mathdoc-ai`).
4. Kết nối và đẩy code lên:
   ```bash
   git remote add origin https://github.com/USER_CUA_BAN/mathdoc-ai.git
   git branch -M main
   git push -u origin main
   ```

### 2. Triển khai lên Vercel
1. Truy cập [Vercel.com](https://vercel.com) và đăng nhập bằng GitHub.
2. Chọn **"Add New"** -> **"Project"**.
3. Import Repository `mathdoc-ai` vừa tạo.
4. **QUAN TRỌNG (Cấu hình Environment Variable):**
   - Tại mục **Environment Variables**, thêm:
     - **Key**: `API_KEY`
     - **Value**: (Dán mã API Key Gemini của bạn vào đây)
5. Nhấn **"Deploy"**.

## 🛠 Cài đặt môi trường phát triển (Local)
1. Clone dự án: `git clone https://github.com/USER_CUA_BAN/mathdoc-ai.git`
2. Cài đặt dependencies: `npm install`
3. Chạy dev mode: `npm run dev`

## 🛡 Bảo mật
- Không bao giờ commit file `.env` chứa API Key lên GitHub công khai.
- Sử dụng các biến môi trường của Vercel để bảo mật thông tin.
