import React, { useState, useEffect, Component } from 'react';
import { 
  Package, 
  FileText, 
  ShoppingCart, 
  CreditCard, 
  Globe, 
  MapPin, 
  Settings,
  LogOut,
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  Table as TableIcon,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  getDocs
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { Category, Item, ModuleType } from './types';

const DEFAULT_CATEGORIES = [
  // Physical Inventory
  { name: 'Electronics', module: 'inventory', sub: ['Computers', 'Phones', 'Accessories'], subSub: { 'Computers': ['Laptops', 'Desktops'] } },
  { name: 'Books', module: 'inventory', sub: ['Classics', 'Mystery', 'Historical', 'Non-fiction'], subSub: { 'Classics': ['Russian Classics', 'British Classics'] } },
  { name: 'Furniture', module: 'inventory' },
  { name: 'Appliances', module: 'inventory' },
  { name: 'Clothing', module: 'inventory' },
  { name: 'Kitchen Items', module: 'inventory' },
  { name: 'Tools', module: 'inventory' },
  { name: 'Vehicles', module: 'inventory' },
  
  // Document Vault
  { name: 'Identity', module: 'documents', sub: ['Passport', 'Aadhaar', 'PAN'] },
  { name: 'Financial', module: 'documents', sub: ['Bank Accounts', 'Insurance', 'Tax'] },
  { name: 'Medical', module: 'documents', sub: ['Prescriptions', 'Reports'] },
  { name: 'Property', module: 'documents' },
  
  // Grocery Inventory
  { name: 'Grains', module: 'groceries', sub: ['Rice', 'Wheat'] },
  { name: 'Vegetables', module: 'groceries', sub: ['Leafy', 'Root'] },
  { name: 'Dairy', module: 'groceries', sub: ['Milk', 'Cheese', 'Butter'] },
  { name: 'Snacks', module: 'groceries' },
  
  // Digital Assets
  { name: 'Software', module: 'digital' },
  { name: 'Subscriptions', module: 'digital' },
  { name: 'Domains', module: 'digital' },
  { name: 'Licenses', module: 'digital' },
  
  // Expense Tracker
  { name: 'Household', module: 'expenses', sub: ['Groceries', 'Utilities', 'Maintenance'] },
  { name: 'Transportation', module: 'expenses' },
  { name: 'Subscriptions', module: 'expenses' },
  { name: 'Miscellaneous', module: 'expenses' },
  
  // Location Manager
  { name: 'Home', module: 'locations', sub: ['Kitchen', 'Bedroom', 'Study'], subSub: { 'Kitchen': ['Pantry', 'Refrigerator'], 'Bedroom': ['Wardrobe', 'Drawer'] } },
];

// Firestore Error Handling
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };
  
  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes('permission')) {
          message = "You don't have permission to perform this action.";
        }
      } catch (e) {}
      
      return (
        <div className="h-screen flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-4">{message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold"
          >
            Reload App
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [activeModule, setActiveModule] = useState<ModuleType>('inventory');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [addItemModule, setAddItemModule] = useState<ModuleType | ''>('');
  const [addItemCategoryId, setAddItemCategoryId] = useState<string>('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currency, setCurrency] = useState({ code: 'USD', symbol: '$' });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['inventory']));

  const currencies = [
    { code: 'USD', symbol: '$' },
    { code: 'INR', symbol: '₹' },
    { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' },
    { code: 'CHF', symbol: 'Fr' },
    { code: 'JPY', symbol: '¥' },
  ];

  const seedUserCategories = async (userId: string) => {
    try {
      const categoriesRef = collection(db, 'categories');
      const q = query(categoriesRef, where('uid', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log("Seeding default categories for user:", userId);
        
        const createCategory = async (name: string, module: string, parentId: string | null = null) => {
          const docRef = await addDoc(categoriesRef, {
            name,
            module,
            parent_id: parentId,
            uid: userId
          });
          return docRef.id;
        };

        for (const cat of DEFAULT_CATEGORIES) {
          const parentId = await createCategory(cat.name, cat.module);
          if (cat.sub) {
            for (const subName of cat.sub) {
              const subId = await createCategory(subName, cat.module, parentId);
              if (cat.subSub && (cat.subSub as any)[subName]) {
                for (const subSubName of (cat.subSub as any)[subName]) {
                  await createCategory(subSubName, cat.module, subId);
                }
              }
            }
          }
        }
        console.log("Seeding completed successfully");
      }
    } catch (error) {
      console.error("Error seeding categories:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (user) {
        seedUserCategories(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'categories'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, 'items'), where('uid', '==', user.uid));
    if (selectedCategoryId) {
      q = query(q, where('category_id', '==', selectedCategoryId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const its = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
      setItems(its);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
    });
    return () => unsubscribe();
  }, [user, selectedCategoryId]);

  const handleGoogleLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google Auth error:", error);
      setAuthError(error.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) return;

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    setIsAuthenticating(true);
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError(error.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsSettingsOpen(false);
  };

  const fetchCategories = async () => {
    // No longer needed due to onSnapshot
  };

  const fetchItems = async (catId?: string) => {
    // No longer needed due to onSnapshot
  };

  const toggleCategory = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  const renderCategoryTree = (module: ModuleType, parentId: string | null = null, depth = 0) => {
    const moduleCategories = categories.filter(c => c.module === module && c.parent_id === parentId);
    
    return moduleCategories.map(cat => {
      const hasChildren = categories.some(c => c.parent_id === cat.id);
      const isExpanded = expandedCategories.has(cat.id);
      const isSelected = selectedCategoryId === cat.id;

      return (
        <div key={cat.id} className="select-none">
          <div 
            className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
              isSelected ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            onClick={() => {
              setSelectedCategoryId(cat.id);
            }}
          >
            <div onClick={(e) => { e.stopPropagation(); toggleCategory(cat.id); }}>
              {hasChildren ? (
                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <div className="w-3.5" />
              )}
            </div>
            {isExpanded ? <FolderOpen size={16} className="text-indigo-400" /> : <Folder size={16} className="text-slate-500" />}
            <span className="text-xs font-medium">{cat.name}</span>
          </div>
          {isExpanded && renderCategoryTree(module, cat.id, depth + 1)}
        </div>
      );
    });
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const modules = [
    { id: 'inventory', name: 'Physical Inventory', icon: Package },
    { id: 'documents', name: 'Document Vault', icon: FileText },
    { id: 'groceries', name: 'Grocery Inventory', icon: ShoppingCart },
    { id: 'expenses', name: 'Expense Tracker', icon: CreditCard },
    { id: 'digital', name: 'Digital Assets', icon: Globe },
    { id: 'locations', name: 'Location Manager', icon: MapPin },
  ];

  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              PIDM
            </h1>
            <p className="text-gray-500 mt-2">Personal Inventory & Document Manager</p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" 
              />
            </div>
            {authError && <p className="text-red-500 text-xs">{authError}</p>}
            <button 
              type="submit"
              disabled={isAuthenticating}
              className={`w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 ${isAuthenticating ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isAuthenticating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {authMode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-100"></div>
            <span className="text-xs text-gray-400 font-bold uppercase">OR</span>
            <div className="flex-1 h-px bg-gray-100"></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={isAuthenticating}
            className={`w-full mt-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 ${isAuthenticating ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <Globe size={20} className="text-blue-500" />
            Continue with Google
          </button>

          <p className="text-center mt-8 text-sm text-gray-500">
            {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="ml-2 text-indigo-600 font-bold hover:underline"
            >
              {authMode === 'login' ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            PIDM
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">Personal Manager</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {modules.map(mod => {
            const isExpanded = expandedModules.has(mod.id);
            const isActive = activeModule === mod.id;

            return (
              <div key={mod.id} className="space-y-1">
                <button
                  onClick={() => {
                    const newExpanded = new Set(expandedModules);
                    if (isExpanded && isActive) {
                      newExpanded.delete(mod.id);
                    } else {
                      newExpanded.add(mod.id);
                    }
                    setExpandedModules(newExpanded);
                    setActiveModule(mod.id as ModuleType);
                    setSelectedCategoryId(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <mod.icon size={20} />
                    <span className="text-sm font-bold">{mod.name}</span>
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
                  </motion.div>
                </button>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 ml-2 border-l border-slate-800">
                        {renderCategoryTree(mod.id as ModuleType)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button 
            onClick={() => setIsAddingCategory(true)}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all"
          >
            <Plus size={20} />
            <span className="text-sm font-semibold">Add Category</span>
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all"
          >
            <Settings size={20} />
            <span className="text-sm font-semibold">Settings</span>
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-900/20 hover:text-red-300 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="text-sm font-semibold">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Search items, documents, expenses..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}
              >
                <ListIcon size={18} />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}
              >
                <TableIcon size={18} />
              </button>
            </div>
            <button 
              onClick={() => setIsAddingCategory(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-all shadow-sm"
            >
              <Plus size={18} />
              New Category
            </button>
            <button 
              onClick={() => {
                setAddItemModule('');
                setAddItemCategoryId('');
                setIsAddingItem(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={18} />
              Add Item
            </button>
            <div className="h-8 w-[1px] bg-gray-200 mx-2" />
            <div className="flex items-center gap-3 pl-2">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-gray-800 truncate max-w-[120px]">
                  {user?.displayName || user?.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  Pro Account
                </span>
              </div>
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border-2 border-white shadow-sm">
                  {user?.email?.[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800">
              {selectedCategoryId 
                ? categories.find(c => c.id === selectedCategoryId)?.name 
                : modules.find(m => m.id === activeModule)?.name}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {filteredItems.length} items found in this category
            </p>
          </div>

          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map(item => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={item.id}
                  className="bg-white p-5 rounded-2xl border border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all group cursor-pointer"
                >
                  <div className="w-full aspect-square bg-gray-50 rounded-xl mb-4 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                    <Package size={48} className="text-gray-200 group-hover:text-indigo-200 transition-colors" />
                  </div>
                  <h3 className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{item.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{item.brand || 'No Brand'}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-indigo-600 font-bold">{currency.symbol}{item.price || 0}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-lg text-gray-500 font-medium">
                      {categories.find(c => c.id === item.category_id)?.name}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="space-y-4">
              {filteredItems.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 hover:shadow-md transition-all">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                    <Package size={24} className="text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{item.name}</h3>
                    <p className="text-xs text-gray-500">{item.brand}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-600">{currency.symbol}{item.price}</p>
                    <p className="text-xs text-gray-400">{item.purchase_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Brand/Author</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 font-bold text-gray-800">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.brand}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-medium">
                          {categories.find(c => c.id === item.category_id)?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-indigo-600">{currency.symbol}{item.price}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{item.purchase_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Item Modal */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingItem(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold mb-6">Add New Item</h2>
                <form className="grid grid-cols-2 gap-6" onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user) return;
                  const formData = new FormData(e.currentTarget);
                  
                  try {
                    await addDoc(collection(db, 'items'), {
                      category_id: formData.get('category_id') as string,
                      module: formData.get('module') as ModuleType,
                      name: formData.get('name') as string,
                      brand: formData.get('brand') as string,
                      price: parseFloat(formData.get('price') as string) || 0,
                      purchase_date: formData.get('date') as string,
                      notes: formData.get('notes') as string,
                      uid: user.uid,
                      createdAt: new Date().toISOString()
                    });
                    setIsAddingItem(false);
                  } catch (error) {
                    handleFirestoreError(error, OperationType.CREATE, 'items');
                  }
                }}>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Item Name</label>
                    <input name="name" required className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Module</label>
                    <select 
                      name="module" 
                      required
                      value={addItemModule}
                      className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                      onChange={(e) => {
                        setAddItemModule(e.target.value as ModuleType);
                        setAddItemCategoryId(''); // Reset category when module changes
                      }}
                    >
                      <option value="" disabled>Select Module</option>
                      {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category</label>
                      <button 
                        type="button"
                        onClick={() => setIsAddingCategory(true)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                      >
                        + New Category
                      </button>
                    </div>
                    <select 
                      name="category_id" 
                      required 
                      value={addItemCategoryId}
                      onChange={(e) => setAddItemCategoryId(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="" disabled>Select Category</option>
                      {categories
                        .filter(c => c.module === addItemModule)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brand / Author</label>
                    <input name="brand" className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price ({currency.code})</label>
                    <input name="price" type="number" step="0.01" className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Purchase Date</label>
                    <input name="date" type="date" className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Location</label>
                    <select className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500">
                      <option>Home</option>
                      <option>Office</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Notes</label>
                    <textarea name="notes" rows={3} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="col-span-2 flex justify-end gap-4 mt-4">
                    <button 
                      type="button"
                      onClick={() => setIsAddingItem(false)}
                      className="px-6 py-2 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                      Save Item
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Category Modal */}
      <AnimatePresence>
        {isAddingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingCategory(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold mb-6">Add New Category</h2>
                <form className="space-y-4" onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user) return;
                  const formData = new FormData(e.currentTarget);
                  
                  try {
                    await addDoc(collection(db, 'categories'), {
                      name: formData.get('name') as string,
                      module: formData.get('module') as ModuleType,
                      parent_id: formData.get('parent_id') || null,
                      uid: user.uid
                    });
                    setIsAddingCategory(false);
                  } catch (error) {
                    handleFirestoreError(error, OperationType.CREATE, 'categories');
                  }
                }}>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category Name</label>
                    <input name="name" required className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Module</label>
                    <select name="module" className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500">
                      {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Parent Category (Optional)</label>
                    <select name="parent_id" className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500">
                      <option value="">None (Root)</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.module})</option>)}
                    </select>
                  </div>
                  <div className="flex justify-end gap-4 mt-6">
                    <button 
                      type="button"
                      onClick={() => setIsAddingCategory(false)}
                      className="px-6 py-2 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                      Save Category
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold mb-6">Settings</h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Preferred Currency</label>
                    <div className="grid grid-cols-2 gap-2">
                      {currencies.map(c => (
                        <button
                          key={c.code}
                          onClick={() => setCurrency(c)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                            currency.code === c.code 
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-600 font-bold' 
                              : 'border-gray-100 hover:border-indigo-200 text-gray-600'
                          }`}
                        >
                          <span>{c.code}</span>
                          <span className="text-lg">{c.symbol}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <button 
                      onClick={handleLogout}
                      className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all"
                    >
                      Logout
                    </button>
                    <button 
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
