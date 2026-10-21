import API from "../../../services/api";

const websiteService = {
  // Blogs
  getBlogs: () => API.get("/admin/website/blog"),
  createBlog: (data) => API.post("/admin/website/blog", data),
  updateBlog: (id, data) => API.put(`/admin/website/blog/${id}`, data),
  deleteBlog: (id) => API.delete(`/admin/website/blog/${id}`),

  // Articles
  getArticles: () => API.get("/admin/website/article"),
  createArticle: (data) => API.post("/admin/website/article", data),
  updateArticle: (id, data) => API.put(`/admin/website/article/${id}`, data),
  deleteArticle: (id) => API.delete(`/admin/website/article/${id}`),

  // Reviews
  getReviews: () => API.get("/admin/website/review"),
  createReview: (data) => API.post("/admin/website/review", data),
  updateReview: (id, data) => API.put(`/admin/website/review/${id}`, data),
  deleteReview: (id) => API.delete(`/admin/website/review/${id}`),

  // Startup Recognition
  getStartupRecognition: () => API.get("/content/startup-recognition"),
  updateStartupRecognition: (data) => API.put("/content/startup-recognition", data),

  // Website Banners (legacy)
  getBanners: () => API.get("/admin/website/banner"),
  createBanner: (data) => API.post("/admin/website/banner", data),
  updateBanner: (id, data) => API.put(`/admin/website/banner/${id}`, data),
  deleteBanner: (id) => API.delete(`/admin/website/banner/${id}`),
};

export default websiteService;
