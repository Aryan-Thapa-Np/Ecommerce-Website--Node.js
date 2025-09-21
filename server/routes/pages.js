import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../database/db.js";
import {
  verifyToken,
  checkAccountStatus,
  checkRole,
  checkOwnershipOrAdmin,
  checkAdminOrStaff,
  checkCustomer,
  checkAuth
} from "../middleware/auth.js";

import { homepage } from "../controller/page/homepage.controller.js";
import { 
  getSubscriptionDetails,
  getGameTopUpDetails,
  getProductDetails,
  getGamePassDetails
} from "../controller/page/product-details.controller.js";
import { checkoutController } from "../controller/page/checkoutpage.controller.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Home page
router.get("/", checkAuth, homepage);

//404 page
router.get("/404", (req, res) => {
  res.render("404", {
    title: "404 - Page Not Found",
    user: req.user || null,
  });
});

//register page
router.get("/register", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "..", "client", "fhsjd", "register.html")
  );
});

//login page
router.get("/login", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "..", "client", "fhsjd", "login.html")
  );
});

//password reset page
router.get("/password-reset", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "..", "client", "fhsjd", "password-reset.html")
  );
});

//help center page
router.get("/help-center", checkAuth, (req, res) => {
  res.render("help-center", {
    title: "Help Center - Carity",
    user: req.userData || null,
    currentPage: 'help-center'
  });
});

//legal page (privacy policy and terms)
router.get("/legal", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "views", "legal.html")
  );
});

//admin pannel
// router.get("/np/admin", verifyToken, checkAdminOrStaff, (req, res) => {
//   res.sendFile(
//     path.join(__dirname, "..", "..", "admin", "324kadsl2pmasd", "admin.html")
//   );
// });

//customer pannel
// router.get("/customer", verifyToken, checkCustomer, (req, res) => {
//   res.sendFile(
//     path.join(__dirname, "..", "..", "client", "fhsjd", "customer.html")
//   );
// });

router.get('/user/dashboard', verifyToken, (req, res) => {
  const role = req.role;
  if(role === 1){
    res.sendFile(
      path.join(__dirname, "..", "..", "admin", "324kadsl2pmasd", "admin.html")
    );
  }else if(role === 2){
    res.sendFile(
      path.join(__dirname, "..", "..", "admin", "324kadsl2pmasd", "admin.html")
    );
  }else{
    res.sendFile(
      path.join(__dirname, "..", "..", "client", "fhsjd", "customer.html")
    );
  }
});


//checkout page
router.get("/checkout", checkAuth, checkoutController);

//search page
router.get("/search",checkAuth, (req, res) => {
  res.render("search", {
    title: "Search",
    user: req.userData || null,
  });
});

//product details pages
router.get("/subscription/:id", checkAuth, getSubscriptionDetails);
router.get("/game/:id/topup", checkAuth, getGameTopUpDetails);
router.get("/game/:id/pass", checkAuth, getGamePassDetails);
router.get("/product-details/:slug", checkAuth, getProductDetails);

export default router;
