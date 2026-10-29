const Blog = require('../../models/Blog');
const Article = require('../../models/Article');
const WebsiteReview = require('../../models/WebsiteReview');
const WebsiteBanner = require('../../models/WebsiteBanner');
const TeamMember = require('../../models/TeamMember');

// Blog Controllers
exports.getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find(req.publicOnly ? { isActive: true } : {}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: blogs.length, data: blogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBlog = async (req, res) => {
  try {
    if (!req.body.slug && req.body.title) {
        req.body.slug = req.body.title.toLowerCase().split(' ').join('-') + '-' + Date.now();
    }
    const blog = await Blog.create(req.body);
    res.status(201).json({ success: true, data: blog });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });
    res.status(200).json({ success: true, data: blog });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });
    res.status(200).json({ success: true, message: "Blog deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Article Controllers
exports.getArticles = async (req, res) => {
  try {
    const articles = await Article.find(req.publicOnly ? { isActive: true } : {}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: articles.length, data: articles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createArticle = async (req, res) => {
  try {
    if (!req.body.slug && req.body.title) {
        req.body.slug = req.body.title.toLowerCase().split(' ').join('-') + '-' + Date.now();
    }
    const article = await Article.create(req.body);
    res.status(201).json({ success: true, data: article });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!article) return res.status(404).json({ success: false, message: "Article not found" });
    res.status(200).json({ success: true, data: article });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: "Article not found" });
    res.status(200).json({ success: true, message: "Article deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// WebsiteReview Controllers
exports.getReviews = async (req, res) => {
  try {
    const reviews = await WebsiteReview.find(req.publicOnly ? { isActive: true } : {}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const review = await WebsiteReview.create(req.body);
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const review = await WebsiteReview.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    res.status(200).json({ success: true, data: review });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await WebsiteReview.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    res.status(200).json({ success: true, message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Website Banner Controllers
exports.getBanners = async (req, res) => {
  try {
    const query = req.publicOnly ? { isActive: true } : {};
    const banners = await WebsiteBanner.find(query).sort({ order: 1, createdAt: -1 });
    res.status(200).json({ success: true, count: banners.length, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBanner = async (req, res) => {
  try {
    const banner = await WebsiteBanner.create(req.body);
    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const banner = await WebsiteBanner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    res.status(200).json({ success: true, data: banner });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const banner = await WebsiteBanner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    res.status(200).json({ success: true, message: "Banner deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== Team Member Controllers ====================

exports.getTeamMembers = async (req, res) => {
  try {
    const query = req.publicOnly ? { isActive: true } : {};
    let members = await TeamMember.find(query).sort({ order: 1, createdAt: 1 });

    // Seed default team members if collection is empty
    if (members.length === 0) {
      const seedMembers = [
        {
          name: 'Chinmay Anand',
          role: 'Founder & CEO',
          bio: 'Designated Partner at GLOBAL RURAL OUTREACH ORGANISATION LLP. Transforming agriculture through technology.',
          order: 1,
          isActive: true,
        },
        {
          name: 'Ifat Khanam',
          role: 'Co-Founder',
          bio: 'Designated Partner at GLOBAL RURAL OUTREACH ORGANISATION LLP. Driving farm mechanization and smart agritech.',
          order: 2,
          isActive: true,
        },
      ];
      await TeamMember.insertMany(seedMembers);
      members = await TeamMember.find(query).sort({ order: 1, createdAt: 1 });
    }

    res.status(200).json({ success: true, count: members.length, data: members });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTeamMember = async (req, res) => {
  try {
    const member = await TeamMember.create(req.body);
    res.status(201).json({ success: true, data: member, message: 'Team member created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateTeamMember = async (req, res) => {
  try {
    const member = await TeamMember.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!member) return res.status(404).json({ success: false, message: "Team member not found" });
    res.status(200).json({ success: true, data: member, message: 'Team member updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteTeamMember = async (req, res) => {
  try {
    const member = await TeamMember.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: "Team member not found" });
    res.status(200).json({ success: true, message: "Team member deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
