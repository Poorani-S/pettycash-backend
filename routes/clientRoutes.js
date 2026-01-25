const express = require("express");
const router = express.Router();
const Client = require("../models/Client");
const { protect, authorize } = require("../middleware/authMiddleware");

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const { search, category, isActive } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const clients = await Client.find(query)
      .populate("createdBy", "name email")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );

    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Create client
// @route   POST /api/clients
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    const {
      name,
      gstNumber,
      email,
      phone,
      address,
      supplyType,
      category,
      bankDetails,
      notes,
    } = req.body;

    // Check if client with same GST number exists
    if (gstNumber) {
      const existingClient = await Client.findOne({ gstNumber });
      if (existingClient) {
        return res.status(400).json({
          success: false,
          message: "Client with this GST number already exists",
        });
      }
    }

    const client = await Client.create({
      name,
      gstNumber,
      email,
      phone,
      address,
      supplyType,
      category,
      bankDetails,
      notes,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: client,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private
router.put("/:id", protect, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: updatedClient,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private (Admin only)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    await client.deleteOne();

    res.status(200).json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
