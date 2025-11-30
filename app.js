// --- Firebase Setup ---
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app';

// --- Shared Utilities ---
const useProjects = () => {
    const [projects, setProjects] = React.useState([]);

    React.useEffect(() => {
        // 1. Load Static Data from project.js
        const staticData = window.projectsData || [];

        // 2. Auth for Firestore
        const initAuth = async () => {
            const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (token) await auth.signInWithCustomToken(token);
            else await auth.signInAnonymously();
        };
        initAuth();

        // 3. Listen to Firestore
        const unsubscribe = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects')
            .onSnapshot(snapshot => {
                const dbData = {};
                snapshot.forEach(doc => dbData[doc.id] = doc.data());

                // Merge: DB overrides Static if IDs match
                const merged = [...staticData];
                Object.values(dbData).forEach(dbP => {
                    const idx = merged.findIndex(p => p.id === dbP.id);
                    if (idx > -1) merged[idx] = { ...merged[idx], ...dbP };
                    else merged.push(dbP);
                });

                setProjects(merged);
            });

        return () => unsubscribe();
    }, []);

    return projects;
};

const getVideoUrl = (p) => {
    let videoUrl = p.videoUrl || p.video || p.videoURL || p.video_link || "";
    if (!videoUrl) return "";
    if (videoUrl.includes("github.com") && videoUrl.includes("/blob/")) {
        videoUrl = videoUrl.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
    }
    return videoUrl;
};

// --- Shared Components ---
const Navbar = ({ activePage }) => (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-[1500px] mx-auto px-4">
            <div className="flex justify-between h-16">
                <a href="index.html" className="flex items-center text-xl font-bold text-gray-900 no-underline">
                    My Portfolio
                </a>
                <div className="flex items-center space-x-4">
                    <a href="index.html" className={`px-3 py-2 rounded-md text-sm font-medium no-underline ${activePage === 'home' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-900'}`}>
                        Portfolio
                    </a>
                    <a href="admin.html" className={`px-3 py-2 rounded-md text-sm font-medium no-underline ${activePage === 'admin' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-900'}`}>
                        <i className="fas fa-lock mr-2"></i> Admin Portal
                    </a>
                </div>
            </div>
        </div>
    </nav>
);

// --- PAGE: HOME (Index) ---
const Home = () => {
    const projects = useProjects();
    const [filter, setFilter] = React.useState("All");
    const categories = ["All", "End to end Event Organization", "On Ground Activations", "Branding", "Concepts & Production"];

    const filteredProjects = React.useMemo(() => {
        if (filter === "All") return projects;
        return projects.filter(p => p.category === filter);
    }, [filter, projects]);

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar activePage="home" />
            <div className="max-w-[1500px] mx-auto px-4 py-8 w-full flex-grow">
                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-3 mb-8 justify-center sm:justify-start">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                                filter === cat 
                                ? 'bg-black text-white border-black shadow-md' 
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Masonry Grid */}
                <div className="masonry-grid">
                    {filteredProjects.map(p => (
                        <ProjectCard key={p.id} project={p} />
                    ))}
                </div>
            </div>
            <Footer />
        </div>
    );
};

const ProjectCard = ({ project }) => {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const videoUrl = getVideoUrl(project);
    const hasVideo = !!videoUrl || !!project.hasVideo;

    const handleClick = () => {
        window.location.href = `project-details.html?id=${project.id}`;
    };

    return (
        <div 
            onClick={handleClick}
            className="break-inside-avoid mb-4 relative group rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all bg-white cursor-pointer border border-gray-100"
        >
            {isPlaying && videoUrl ? (
                <video 
                    src={videoUrl} 
                    controls 
                    autoPlay 
                    className="w-full h-auto object-contain"
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <>
                    <img 
                        src={project.thumbnail || 'https://placehold.co/400x300?text=No+Image'} 
                        alt={project.title} 
                        className="w-full h-auto block"
                        loading="lazy"
                    />
                    {hasVideo && (
                        <div 
                            className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition z-10"
                            onClick={(e) => { e.stopPropagation(); setIsPlaying(true); }}
                            title="Play Video"
                        >
                            <i className="fas fa-play text-xs"></i>
                        </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center">
                        <span className="text-white font-medium text-center text-sm">{project.title}</span>
                    </div>
                </>
            )}
        </div>
    );
};

// --- PAGE: DETAILS ---
const Details = () => {
    const projects = useProjects();
    const [project, setProject] = React.useState(null);
    const [slideIndex, setSlideIndex] = React.useState(0);

    React.useEffect(() => {
        if (projects.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const id = params.get("id");
            const found = projects.find(p => p.id == id);
            setProject(found);
        }
    }, [projects]);

    if (!project && projects.length === 0) return <div className="p-10 text-center">Loading...</div>;
    if (!project) return <div className="p-10 text-center">Project not found.</div>;

    const videoUrl = getVideoUrl(project);
    const slideshow = project.slideshow || [];

    const nextSlide = () => setSlideIndex((prev) => (prev + 1) % slideshow.length);
    const prevSlide = () => setSlideIndex((prev) => (prev - 1 + slideshow.length) % slideshow.length);

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar activePage="details" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in w-full flex-grow">
                <a href="index.html" className="inline-flex items-center text-gray-600 hover:text-black transition mb-6 no-underline">
                    <i className="fas fa-arrow-left mr-2"></i> Back to Gallery
                </a>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2">
                        <h1 className="text-4xl font-bold mb-4">{project.title}</h1>
                        <p className="text-lg text-gray-700 leading-relaxed mb-8 whitespace-pre-wrap">
                            {project.description || "No description available."}
                        </p>
                        
                        <div className="space-y-8">
                            {/* Main Image */}
                            {project.thumbnail && (
                                <img src={project.thumbnail} alt="Main" className="w-full h-auto rounded-lg shadow-md" />
                            )}
                            
                            {/* Video */}
                            {videoUrl && (
                                <div className="rounded-lg overflow-hidden shadow-md bg-black">
                                    <video controls className="w-full max-h-[600px]">
                                        <source src={videoUrl} type="video/mp4" />
                                    </video>
                                </div>
                            )}

                            {/* Slideshow */}
                            {slideshow.length > 0 && (
                                <div className="relative rounded-lg overflow-hidden shadow-md bg-gray-100 group">
                                    <img src={slideshow[slideIndex]} alt="Slide" className="w-full h-auto object-contain max-h-[600px]" />
                                    {slideshow.length > 1 && (
                                        <>
                                            <button onClick={prevSlide} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white p-3 rounded-full transition">❮</button>
                                            <button onClick={nextSlide} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white p-3 rounded-full transition">❯</button>
                                            <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
                                                {slideshow.map((_, idx) => (
                                                    <div key={idx} onClick={() => setSlideIndex(idx)} className={`w-2 h-2 rounded-full cursor-pointer ${idx === slideIndex ? 'bg-white' : 'bg-white/50'}`} />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Info */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit sticky top-24">
                        <h3 className="text-xl font-bold mb-4 border-b pb-2">Project Info</h3>
                        <div className="space-y-4">
                            <InfoRow label="Client" value={project.client} />
                            <InfoRow label="Industry" value={project.industry} />
                            <InfoRow label="Category" value={project.category} />
                            <InfoRow label="Country" value={project.country} />
                            <InfoRow label="Year" value={project.year || (project.date ? new Date(project.date).getFullYear() : "")} />
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};
const InfoRow = ({ label, value }) => (
    <div><span className="font-semibold block text-gray-500 text-sm">{label}</span> {value || "—"}</div>
);

// --- PAGE: ADMIN ---
const Admin = () => {
    const projects = useProjects();
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);
    const [password, setPassword] = React.useState("");
    const [editingId, setEditingId] = React.useState(null);
    const [formData, setFormData] = React.useState({});

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === "admin123") setIsAuthenticated(true);
        else alert("Incorrect Password");
    };

    const startEdit = (p) => {
        setEditingId(p.id);
        setFormData({ ...p, slideshow: p.slideshow ? p.slideshow.join('\n') : '' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const startNew = () => {
        setEditingId("new");
        setFormData({
            id: `custom-${Date.now()}`,
            title: "", category: "Branding", description: "", thumbnail: "", video: "", slideshow: "", client: "", country: ""
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async () => {
        if (!formData.title) return alert("Title is required");
        const processedData = {
            ...formData,
            slideshow: typeof formData.slideshow === 'string' ? formData.slideshow.split('\n').map(s => s.trim()).filter(Boolean) : formData.slideshow
        };

        try {
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects').doc(processedData.id).set(processedData);
            alert("Project Saved Successfully!");
            setEditingId(null);
        } catch (error) {
            console.error(error);
            alert("Error saving project.");
        }
    };

    if (!isAuthenticated) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-md max-w-sm w-full border text-center">
                <i className="fas fa-lock text-4xl text-blue-500 mb-4"></i>
                <h2 className="text-2xl font-bold mb-6">Admin Login</h2>
                <input type="password" placeholder="Password" className="w-full p-3 border rounded mb-4" value={password} onChange={e => setPassword(e.target.value)} />
                <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-bold">Access Portal</button>
            </form>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar activePage="admin" />
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold">Project Manager</h2>
                    <button onClick={startNew} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow-sm"><i className="fas fa-plus mr-2"></i> Add New</button>
                </div>

                {editingId && (
                    <div className="bg-white p-6 rounded-lg shadow-lg border border-blue-200 mb-8 animate-fade-in">
                        <h3 className="text-xl font-bold mb-4 border-b pb-2">{editingId === 'new' ? 'New Project' : 'Edit Project'}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">Title</label>
                                <input className="w-full p-2 border rounded" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Category</label>
                                <select className="w-full p-2 border rounded" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                    {["Branding", "Concepts & Production", "End to end Event Organization", "On Ground Activations"].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Thumbnail URL</label>
                                <input className="w-full p-2 border rounded" value={formData.thumbnail || ''} onChange={e => setFormData({...formData, thumbnail: e.target.value})} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea className="w-full p-2 border rounded h-24" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">Slideshow URLs (One per line)</label>
                                <textarea className="w-full p-2 border rounded h-24 font-mono text-xs" value={formData.slideshow || ''} onChange={e => setFormData({...formData, slideshow: e.target.value})}></textarea>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setEditingId(null)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {projects.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 flex items-center">
                                        <img className="h-10 w-10 rounded object-cover mr-4" src={p.thumbnail || 'https://via.placeholder.com/50'} alt="" />
                                        <span className="text-sm font-medium text-gray-900">{p.title}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{p.category}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <button onClick={() => startEdit(p)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const Footer = () => (
    <footer className="bg-white border-t mt-auto py-8 text-center text-gray-500 text-sm">
        <p>© 2025 Portfolio. All rights reserved.</p>
    </footer>
);

// --- MAIN ENTRY POINT ---
// Determine which component to mount based on the root ID present in HTML
const rootElement = document.getElementById('root-home') || document.getElementById('root-details') || document.getElementById('root-admin');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    if (rootElement.id === 'root-home') root.render(<Home />);
    if (rootElement.id === 'root-details') root.render(<Details />);
    if (rootElement.id === 'root-admin') root.render(<Admin />);
}