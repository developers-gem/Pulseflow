// import mongoose from "mongoose";

// const userSchema = new mongoose.Schema({

//     name:{
//         type:String,
//         required:true
//     },

//     email:{
//         type:String,
//         unique:true,
//         required:true
//     },

//     password:{
//         type:String,
//         required:true
//     },

//     role:{
//         type:String,
//         enum:[
//             "superadmin",
//             "admin",
//             "doctor",
//             "nurse",
//             "receptionist",
//             "lab",
//             "pharmacist"
//         ],
//         default:"admin"
//     },

//     permissions:[String]

// },{
//     timestamps:true
// })

import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },

    role: {
      type: String,
      enum: [
        "superadmin",
        "admin",
        "doctor",
        "nurse",
        "receptionist",
        "lab",
        "pharmacist",
      ],
      default: "admin",
    },

    permissions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (err) {
    next(err);
  }
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Remove sensitive fields before sending user to frontend
userSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    permissions: this.permissions,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.model("User", userSchema);

export default User;