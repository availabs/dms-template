/* The name → React-component icon map for the Tessera theme.
 *
 * The theme references icons by NAME (e.g. `iconName: 'Search'`), not by
 * import. This file is the place that resolves those names to actual
 * components.
 *
 * v0.1 uses Lucide as the working set per `Tessera Design System/README.md`
 * — close to Phosphor in feel, 1.5px stroke, geometric, line-based, freely
 * available on npm. When a custom drawn icon set ships, swap the per-name
 * imports for the custom components without touching the theme.
 *
 * The icon names below match what `tessera-theme.js` references:
 *   - Menu, ChevronDown, ChevronRight, ChevronLeft, XMark, Plus, Pencil,
 *     Trash, Check, Search, Settings, User, Logo
 *   - Plus brand-specific additions for the brand's use cases.
 *
 * To use:
 *   import Icons from './design_system_v2/theme/icons';
 *   <Icons.Search className="w-4 h-4" />
 *
 * Or, in DMS form, merge into the theme:
 *   theme.Icons = { ...theme.Icons, ...Icons };
 */

import {
  // Navigation / chrome
  Menu,
  X as XMark,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,

  // Actions
  Plus,
  Pencil,
  Trash2 as Trash,
  Check,
  CheckCircle as CircleCheck,
  Search,
  Settings,
  User,
  Save,
  Copy,
  Download,
  Upload,
  Eye,
  EyeOff,

  // Data / table
  Filter,
  ArrowDownUp as Sort,
  Columns3 as Columns,
  Rows3 as Rows,
  Database,
  Table as TableIcon,

  // Map / cartographic
  Map,
  MapPin,
  Layers,

  // Content
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,

  // State
  AlertCircle,
  AlertTriangle,
  Info,
  Loader,

  // Generic geometry — used as the Tessera "tile" mark when no specific
  // icon exists for a context.
  Square,
  SquareDot,
} from 'lucide-react';

/* Map the brand's named registry to Lucide components. Names on the left
   are the ones referenced in `tessera-theme.js`; components on the right
   are whatever the icon library provides. */

const Icons = {
  // Navigation
  Menu,
  XMark,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,

  // Actions
  Plus,
  Pencil,
  Trash,
  Check,
  CircleCheck,
  Search,
  Settings,
  User,
  Save,
  Copy,
  Download,
  Upload,
  Eye,
  EyeOff,

  // Data / table
  Filter,
  Sort,
  Columns,
  Rows,
  Database,
  Table: TableIcon,

  // Map
  Map,
  MapPin,
  Layers,

  // Content
  FileText,
  Image: ImageIcon,
  Link: LinkIcon,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,

  // State
  AlertCircle,
  AlertTriangle,
  Info,
  Loader,

  // The Tessera tile — generic placeholder when nothing else fits.
  // Renders as a small square; works as a "this is a tessera" mark.
  Tessera: Square,
  TileMark: SquareDot,
};

export default Icons;
