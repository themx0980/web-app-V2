import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged,
  signInWithPopup, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc,
  addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
  limit, startAfter, getDocs, getDoc,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDNFfGuxhG1QG55vDNhEyPYtfD79ZByvsM",
  authDomain: "dff-stream.firebaseapp.com",
  projectId: "dff-stream",
  storageBucket: "dff-stream.firebasestorage.app",
  messagingSenderId: "723534931442",
  appId: "1:723534931442:web:2593764e5ce46000c2776b"
};
const OWNER_UID = "uivcffgjjj";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const gp = new GoogleAuthProvider();

// Elements
const loginBtn = document.getElementById("login-main-btn"),
      registerBtn = document.getElementById("register-main-btn"),
      logoutBtn = document.getElementById("logout-btn"),
      userInfo = document.getElementById("user-info"),
      newCommentEl = document.getElementById("new-comment"),
      postCommentBtn = document.getElementById("post-comment-btn"),
      commentsDiv = document.getElementById("comments"),
      loadMoreBtn = document.getElementById("load-more-btn");

// Get videoId from URL
const videoId = new URLSearchParams(window.location.search).get('id');
if (!videoId) alert("Video ID missing! Comments will not work.");

// Modal handlers
window.closeModal = id => document.getElementById(id).classList.add("hidden");
const openModal = id => document.getElementById(id).classList.remove("hidden");

// Auth handlers
loginBtn.onclick = () => openModal("login-modal");
registerBtn.onclick = () => openModal("register-modal");
logoutBtn.onclick = () => signOut(auth);

document.getElementById("login-email-btn").onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, document.getElementById("login-email").value, document.getElementById("login-pass").value);
    closeModal("login-modal");
  } catch(e) { alert(e.message); }
};

document.getElementById("login-google-btn").onclick = async () => {
  try {
    await signInWithPopup(auth, gp);
    closeModal("login-modal");
  } catch(e) { alert(e.message); }
};

document.getElementById("register-email-btn").onclick = async () => {
  try {
    await createUserWithEmailAndPassword(auth, document.getElementById("reg-email").value, document.getElementById("reg-pass").value);
    closeModal("register-modal");
  } catch(e) { alert(e.message); }
};

document.getElementById("register-google-btn").onclick = async () => {
  try {
    await signInWithPopup(auth, gp);
    closeModal("register-modal");
  } catch(e) { alert(e.message); }
};

document.getElementById("register-guest-btn").onclick = async () => {
  try {
    await signInAnonymously(auth);
    closeModal("register-modal");
  } catch(e) { alert(e.message); }
};

let currentUser = null, lastVisible = null;
const PAGE_SIZE = 10;

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    userInfo.textContent = `Hello, ${user.displayName || "Anonymous"}`;
    document.querySelectorAll(".auth-show").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".auth-hide").forEach(el => el.classList.remove("hidden"));
  } else {
    userInfo.textContent = "Not signed in";
    document.querySelectorAll(".auth-show").forEach(el => el.classList.remove("hidden"));
    document.querySelectorAll(".auth-hide").forEach(el => el.classList.add("hidden"));
  }
  loadComments(true);
});

function timeAgo(ts) {
  const now = Date.now(), secs = Math.floor((now - ts.toMillis()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const m = Math.floor(secs / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Post comment
postCommentBtn.onclick = async () => {
  if (!currentUser) return alert("Please login first");
  const txt = newCommentEl.value.trim();
  if (!txt) return;
  await addDoc(collection(db, "videos", videoId, "comments"), {
    text: txt,
    uid: currentUser.uid,
    name: currentUser.displayName || "Anonymous",
    photoURL: currentUser.photoURL || "https://raw.githubusercontent.com/thelx0980/social/refs/heads/main/anonymous.jpeg",
    created: serverTimestamp(),
    edited: false,
    likes: [],
    dislikes: []
  });
  newCommentEl.value = "";
  loadComments(true);
};

// Load comments
async function loadComments(reset = false) {
  if (!videoId) return;
  if (reset) {
    commentsDiv.innerHTML = "";
    lastVisible = null;
  }
  let q = query(collection(db, "videos", videoId, "comments"), orderBy("created", "desc"), limit(PAGE_SIZE));
  if (lastVisible) q = query(collection(db, "videos", videoId, "comments"), orderBy("created", "desc"), startAfter(lastVisible), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  if (!snap.empty) {
    lastVisible = snap.docs[snap.docs.length - 1];
    snap.docs.forEach(docSnap => renderComment(docSnap.id, docSnap.data()));
  }
  loadMoreBtn.classList.toggle("hidden", snap.size < PAGE_SIZE);
}

loadMoreBtn.onclick = () => loadComments();

async function loadReplies(parentId, container, reset = false) {
  if (!videoId) return;
  if (reset) container.innerHTML = "";
  const snap = await getDocs(query(collection(db, "videos", videoId, "comments", parentId, "replies"), orderBy("created", "asc")));
  const replies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  replies.slice(0, 5).forEach(r => renderReply(r, container));
  if (replies.length > 5) {
    const btn = document.createElement("button");
    btn.textContent = `Show ${replies.length - 5} more replies`;
    btn.className = "text-sm text-blue-500 ml-6";
    btn.onclick = () => {
      replies.slice(5).forEach(r => renderReply(r, container));
      btn.remove();
    };
    container.appendChild(btn);
  }
}

function renderReply({ id, name, text, created, photoURL, uid }, container) {
  const isAdmin = uid === OWNER_UID;
  const avatar = photoURL || '/default-avatar.png';
  const el = document.createElement("div");
  el.className = "bg-gray-50 p-2 rounded mb-1 flex items-start gap-2";
  el.innerHTML = `
    <img src="${avatar}" class="w-6 h-6 rounded-full ${isAdmin ? 'ring-2 ring-yellow-400' : ''}" alt="${name}" />
    <div class="flex-1">
      <div class="flex justify-between">
        <p class="text-sm font-semibold ${isAdmin ? 'text-yellow-600' : ''}">${name}${isAdmin ? ' ★' : ''}</p>
        <p class="text-xs text-gray-500">${created ? timeAgo(created) : ''}</p>
      </div>
      <p class="text-sm ml-1">${text}</p>
    </div>`;
  container.appendChild(el);
}

function renderComment(id, data) {
  const isOwner = currentUser?.uid === data.uid;
  const isAdmin = currentUser?.uid === OWNER_UID;
  const youLiked = currentUser && data.likes.includes(currentUser.uid);
  const youDisliked = currentUser && data.dislikes.includes(currentUser.uid);
  const avatarURL = data.photoURL || '/default-avatar.png';

  const actions = [];
  actions.push(`<button data-action="like" class="mr-2 ${youLiked ? 'text-blue-600' : ''}">👍 ${data.likes.length}</button>`);
  actions.push(`<button data-action="dislike" class="mr-2 ${youDisliked ? 'text-red-600' : ''}">👎 ${data.dislikes.length}</button>`);
  actions.push(`<button data-action="reply" class="mr-2">Reply</button>`);
  if (isOwner || isAdmin) {
    actions.push(`<button data-action="edit" class="mr-2">Edit</button>`);
    actions.push(`<button data-action="delete" class="text-red-500">Delete</button>`);
  }

  const div = document.createElement("div");
  div.className = `bg-white p-4 rounded shadow-sm ${data.uid === OWNER_UID ? 'border-2 border-yellow-400' : ''}`;
  div.innerHTML = `
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-2">
        <img src="${avatarURL}" class="w-8 h-8 rounded-full ${data.uid === OWNER_UID ? 'ring-2 ring-yellow-400' : ''}" />
        <p class="font-semibold ${data.uid === OWNER_UID ? 'text-yellow-600' : ''}">${data.name}${data.uid === OWNER_UID ? ' ★' : ''}</p>
      </div>
      <p class="text-xs text-gray-500">${data.created ? timeAgo(data.created) : ''}${data.edited ? ' • edited' : ''}</p>
    </div>
    <p class="my-2">${data.text}</p>
    <div class="flex items-center text-sm text-gray-600">${actions.join('')}</div>
    <div class="ml-6 mt-2 reply-form hidden">
      <textarea rows="2" class="w-full border rounded p-2" placeholder="Write a reply..."></textarea>
      <button class="mt-1 px-3 py-1 bg-indigo-500 text-white rounded post-reply-btn">Reply</button>
    </div>
    <div class="ml-6 mt-2 replies"></div>
  `;

  const handleAction = async (action) => {
    if (!videoId) return;
    const commentRef = doc(db, "videos", videoId, "comments", id);
    if (action === 'like' || action === 'dislike') {
      if (!currentUser) return alert("Login first");
      const fieldAdd = action === 'like' ? 'likes' : 'dislikes';
      const fieldRem = action === 'like' ? 'dislikes' : 'likes';
      const snap = await getDoc(commentRef);
      const d = snap.data();
      if (d[fieldAdd].includes(currentUser.uid)) {
        await updateDoc(commentRef, { [fieldAdd]: arrayRemove(currentUser.uid) });
      } else {
        if (d[fieldRem].includes(currentUser.uid)) await updateDoc(commentRef, { [fieldRem]: arrayRemove(currentUser.uid) });
        await updateDoc(commentRef, { [fieldAdd]: arrayUnion(currentUser.uid) });
      }
      loadComments(true);
    }
    else if (action === 'reply') {
      div.querySelector('.reply-form').classList.toggle('hidden');
    }
    else if (action === 'edit') {
      const t = prompt("Edit comment:", data.text);
      if (t != null) {
        await updateDoc(commentRef, { text: t, edited: true });
        loadComments(true);
      }
    }
    else if (action === 'delete') {
      if (confirm("Delete this comment?")) {
        await deleteDoc(commentRef);
        loadComments(true);
      }
    }
  };

  div.querySelectorAll("button").forEach(btn => {
    const act = btn.getAttribute('data-action');
    if (act) btn.onclick = () => handleAction(act);
  });

  const replyForm = div.querySelector('.reply-form');
  const repliesC = div.querySelector('.replies');

  div.querySelector('.post-reply-btn').onclick = async () => {
    if (!currentUser || !videoId) return alert("Login first");
    const ta = replyForm.querySelector("textarea");
    const txt = ta.value.trim();
    if (!txt) return;
    await addDoc(collection(db, "videos", videoId, "comments", id, "replies"), {
      text: txt,
      uid: currentUser.uid,
      name: currentUser.displayName || "Guest",
      photoURL: currentUser.photoURL || null,
      created: serverTimestamp()
    });
    ta.value = '';
    replyForm.classList.add('hidden');
    loadReplies(id, repliesC, true);
  };

  loadReplies(id, repliesC, true);
  commentsDiv.appendChild(div);
}
