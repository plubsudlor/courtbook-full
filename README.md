# CourtBook - ระบบจองสนามบาสเกตบอล

Node.js + Express + MongoDB (MongoDB Native Driver)

## วิธีรัน
1. ติดตั้งและเปิด MongoDB (หรือใช้ MongoDB Atlas แล้วตั้งค่า `MONGODB_URI`)
2. `npm install`
3. `npm start` แล้วเปิด http://localhost:3000

## API
| Method | Path | หน้าที่ |
|---|---|---|
| GET | /api/courts | รายชื่อสนาม |
| GET | /api/bookings | รายการจองทั้งหมด |
| POST | /api/bookings | จองสนาม (court, date YYYY-MM-DD, hour 8-21, name, phone) |
| PATCH | /api/bookings/:id/cancel | ยกเลิกการจอง |

รหัสตอบกลับ: 201 จองสำเร็จ, 400 ข้อมูลผิด/สนามปิดซ่อม, 404 ไม่พบ, 409 จองซ้ำ/เบอร์ซ้ำ
"# courtbook-full" 
