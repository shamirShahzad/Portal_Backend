# Course Schema Changes - Frontend Update Guide

## 📅 Date: 2025-10-15
## 🔄 Change: Added `is_tamkeen_support` boolean field to courses

---

## 🗄️ Database Changes

### New Column Added:
- **Field Name**: `is_tamkeen_support`
- **Type**: `boolean`
- **Default Value**: `false`
- **Required**: `true`
- **Description**: Indicates if a course has Tamkeen support/funding

---

## 📋 Frontend Required Changes

### 1. **Course Type/Interface Updates**

```typescript
// Update your Course interface/type
interface Course {
  id?: string;
  title: string;
  subtitle: string;
  category: string;
  duration: string;
  format: string;
  level: string;
  description: string;
  prerequisites: string[];
  thumbnail_url: string;
  price: number;
  is_active: boolean;
  is_tamkeen_support: boolean;  // ✅ NEW FIELD
  created_at?: Date;
  updated_at?: Date;
}

// Update your CourseUpdate interface/type
interface CourseUpdate {
  id?: string;
  title?: string;
  subtitle?: string;
  category?: string;
  duration?: string;
  format?: string;
  level?: string;
  description?: string;
  prerequisites?: string[];
  thumbnail_url?: string;
  price?: number;
  is_active?: boolean;
  is_tamkeen_support?: boolean;  // ✅ NEW FIELD
  updated_at?: Date;
}
```

### 2. **Form Updates Required**

#### **Course Creation Form**
```html
<!-- Add this field to your course creation form -->
<div class="form-field">
  <label for="is_tamkeen_support">Tamkeen Support</label>
  <input 
    type="checkbox" 
    id="is_tamkeen_support" 
    name="is_tamkeen_support"
    v-model="course.is_tamkeen_support"  <!-- Vue.js -->
    [(ngModel)]="course.is_tamkeen_support"  <!-- Angular -->
  />
  <span>This course has Tamkeen support/funding</span>
</div>
```

#### **Course Edit Form**
```html
<!-- Add this field to your course edit form -->
<div class="form-field">
  <label for="is_tamkeen_support">Tamkeen Support</label>
  <input 
    type="checkbox" 
    id="is_tamkeen_support" 
    name="is_tamkeen_support"
    v-model="editCourse.is_tamkeen_support"  <!-- Vue.js -->
    [(ngModel)]="editCourse.is_tamkeen_support"  <!-- Angular -->
  />
  <span>This course has Tamkeen support/funding</span>
</div>
```

### 3. **API Request Updates**

#### **Create Course API Call**
```javascript
// When creating a course, include the new field
const createCourse = async (courseData) => {
  const formData = new FormData();
  
  // Existing fields
  formData.append('title', courseData.title);
  formData.append('subtitle', courseData.subtitle);
  formData.append('category', courseData.category);
  formData.append('duration', courseData.duration);
  formData.append('format', courseData.format);
  formData.append('level', courseData.level);
  formData.append('description', courseData.description);
  formData.append('prerequisites', JSON.stringify(courseData.prerequisites));
  formData.append('price', courseData.price.toString());
  formData.append('is_active', courseData.is_active.toString());
  
  // ✅ NEW FIELD
  formData.append('is_tamkeen_support', courseData.is_tamkeen_support.toString());
  
  // File upload if exists
  if (courseData.thumbnail) {
    formData.append('thumbnail', courseData.thumbnail);
  }
  
  return await fetch('/api/v1/courses', {
    method: 'POST',
    body: formData
  });
};
```

#### **Update Course API Call**
```javascript
// When updating a course, include the new field
const updateCourse = async (courseId, courseData) => {
  const payload = {
    title: courseData.title,
    subtitle: courseData.subtitle,
    category: courseData.category,
    duration: courseData.duration,
    format: courseData.format,
    level: courseData.level,
    description: courseData.description,
    prerequisites: courseData.prerequisites,
    price: courseData.price,
    is_active: courseData.is_active,
    is_tamkeen_support: courseData.is_tamkeen_support,  // ✅ NEW FIELD
  };
  
  return await fetch(`/api/v1/courses/${courseId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
};
```

### 4. **Display Updates**

#### **Course Card/List Display**
```html
<!-- Add Tamkeen support indicator to course cards -->
<div class="course-card">
  <h3>{{ course.title }}</h3>
  <p>{{ course.subtitle }}</p>
  <div class="course-badges">
    <span v-if="course.is_active" class="badge active">Active</span>
    <!-- ✅ NEW BADGE -->
    <span v-if="course.is_tamkeen_support" class="badge tamkeen">
      🏛️ Tamkeen Support
    </span>
  </div>
  <p class="price">${{ course.price }}</p>
</div>
```

#### **Course Details Page**
```html
<!-- Add Tamkeen support information to course details -->
<div class="course-details">
  <h1>{{ course.title }}</h1>
  <div class="course-info">
    <p><strong>Category:</strong> {{ course.category }}</p>
    <p><strong>Duration:</strong> {{ course.duration }}</p>
    <p><strong>Level:</strong> {{ course.level }}</p>
    <p><strong>Price:</strong> ${{ course.price }}</p>
    
    <!-- ✅ NEW INFO -->
    <p v-if="course.is_tamkeen_support" class="tamkeen-info">
      <strong>💰 Funding:</strong> This course is supported by Tamkeen
    </p>
  </div>
</div>
```

### 5. **Filter/Search Updates**

#### **Course Filtering**
```javascript
// Add Tamkeen support filter option
const filterOptions = {
  category: ['all', 'programming', 'design', 'business'],
  level: ['all', 'beginner', 'intermediate', 'advanced'],
  is_active: ['all', true, false],
  is_tamkeen_support: ['all', true, false],  // ✅ NEW FILTER
};

// Filter function update
const filterCourses = (courses, filters) => {
  return courses.filter(course => {
    // Existing filters
    const categoryMatch = filters.category === 'all' || course.category === filters.category;
    const levelMatch = filters.level === 'all' || course.level === filters.level;
    const activeMatch = filters.is_active === 'all' || course.is_active === filters.is_active;
    
    // ✅ NEW FILTER
    const tamkeenMatch = filters.is_tamkeen_support === 'all' || 
                        course.is_tamkeen_support === filters.is_tamkeen_support;
    
    return categoryMatch && levelMatch && activeMatch && tamkeenMatch;
  });
};
```

### 6. **Default Values**

#### **Form Initialization**
```javascript
// Set default values for new course form
const initializeCourseForm = () => {
  return {
    title: '',
    subtitle: '',
    category: '',
    duration: '',
    format: '',
    level: '',
    description: '',
    prerequisites: [],
    thumbnail_url: '',
    price: 0,
    is_active: true,
    is_tamkeen_support: false,  // ✅ DEFAULT TO FALSE
  };
};
```

---

## 🎨 UI/UX Suggestions

### **Visual Indicators**
1. **Tamkeen Badge**: Add a distinctive badge/icon for courses with Tamkeen support
2. **Color Coding**: Use a specific color (e.g., green/gold) for Tamkeen-supported courses
3. **Icons**: Use 🏛️ or 💰 icons to represent Tamkeen support

### **User Experience**
1. **Tooltip**: Add tooltips explaining what Tamkeen support means
2. **Filter Section**: Add "Tamkeen Supported" as a filter option
3. **Sort Option**: Allow sorting by Tamkeen support status

---

## 📝 Testing Checklist

### **Frontend Testing Required**
- [ ] Course creation form accepts `is_tamkeen_support` field
- [ ] Course edit form displays and updates `is_tamkeen_support` field
- [ ] Course listing displays Tamkeen support indicator
- [ ] Course filtering works with Tamkeen support option
- [ ] API calls include the new field in requests
- [ ] Course details page shows Tamkeen support information
- [ ] Form validation handles boolean conversion properly

### **✅ NEW: Application/JOIN Data Testing Required**
- [ ] Application listings display Tamkeen support for courses
- [ ] Manager approval pages show Tamkeen support information
- [ ] Export functionality includes Tamkeen support data
- [ ] Detailed application views show course Tamkeen status
- [ ] Filter options include Tamkeen support filtering
- [ ] Downloaded files (Excel, CSV, PDF) contain Tamkeen column

### **API Endpoints to Test**
- [ ] `POST /api/v1/courses` - Create course with `is_tamkeen_support`
- [ ] `PUT /api/v1/courses/:id` - Update course with `is_tamkeen_support`
- [ ] `GET /api/v1/courses` - Retrieve courses with new field
- [ ] `GET /api/v1/courses?id=:id` - Retrieve single course with new field
- [ ] `GET /api/v1/applications/detailed` - Applications with course Tamkeen data
- [ ] `GET /api/v1/manager-approval/:id` - Manager approval with course Tamkeen data
- [ ] `POST /api/v1/exports` - Export files include Tamkeen support data

---

## 🚀 Deployment Notes

1. **Backend**: Migration already applied ✅
2. **Frontend**: Update your course components and forms
3. **Testing**: Test course creation/editing with new field
4. **Data**: All existing courses have `is_tamkeen_support = false` by default

---

## 📞 Support

If you need any clarification or encounter issues implementing these changes, please reach out to the backend team.

**Backend Changes Completed**: ✅  
**Frontend Implementation Required**: 🔄 In Progress

---

## 🔗 JOIN Query Updates

### Additional Backend Changes for JOIN Queries

The following database functions have been updated to include the new `is_tamkeen_support` field when joining with the courses table:

#### **Updated Application Database Functions** 
(`/src/db/functions/application_db_functions.ts`)

1. **getDetailedApplications()** - Now includes `c.is_tamkeen_support AS course_is_tamkeen_support`
2. **getDetailedApplicationsForExport()** - Now includes `c.is_tamkeen_support AS course_is_tamkeen_support`

#### **Updated Manager Approval Database Functions** 
(`/src/db/functions/manager_approval_db_functions.ts`)

1. **getApplicationForReview()** - Now includes `c.is_tamkeen_support AS course_is_tamkeen_support`

#### **Updated Export File Generators** 
(`/src/util/fileGenerators.ts`)

1. **Excel Export**: Added "Tamkeen Support" column showing "Yes"/"No"
2. **CSV Export**: Added "Tamkeen Support" column in proper position
3. **PDF Export**: Added Tamkeen support info in application/course listings

### **Impact on API Responses**

When fetching detailed applications (applications with course data), the response will now include:

```typescript
// Previous response
{
  "id": "...",
  "applicant_name": "John Doe",
  "course_title": "Advanced JavaScript",
  "course_category": "Programming",
  "course_price": 500,
  // ... other fields
}

// ✅ NEW response includes
{
  "id": "...",
  "applicant_name": "John Doe", 
  "course_title": "Advanced JavaScript",
  "course_category": "Programming", 
  "course_price": 500,
  "course_is_tamkeen_support": true,  // ✅ NEW FIELD
  // ... other fields
}
```

### **Frontend Updates Required for JOIN Data**

#### **Application Lists with Course Information**
```typescript
// Update interfaces for detailed applications
interface DetailedApplication {
  // Application fields
  id: string;
  applicant_name: string;
  status: string;
  priority: string;
  submitted_at: string;
  
  // Course fields from JOIN
  course_title: string;
  course_category: string;
  course_duration: string;
  course_format: string;
  course_level: string;
  course_thumbnail_url: string;
  course_price: number;
  course_is_tamkeen_support: boolean;  // ✅ NEW FIELD
  
  // Other fields...
}
```

#### **Application List Display Updates**
```html
<!-- Update application listings to show Tamkeen support -->
<div class="application-card">
  <h3>{{ application.applicant_name }}</h3>
  <p><strong>Course:</strong> {{ application.course_title }}</p>
  
  <!-- ✅ NEW Tamkeen indicator -->
  <div class="course-badges">
    <span v-if="application.course_is_tamkeen_support" class="badge tamkeen">
      🏛️ Tamkeen Supported
    </span>
  </div>
  
  <p><strong>Status:</strong> {{ application.status }}</p>
  <p><strong>Price:</strong> ${{ application.course_price }}</p>
</div>
```

#### **Export File Downloads**
The exported files (Excel, CSV, PDF) will now include the Tamkeen support information:

- **Excel**: New "Tamkeen Support" column (Yes/No)
- **CSV**: New "Tamkeen Support" column (Yes/No) 
- **PDF**: Tamkeen info included in application summaries

---

## 📊 Export/Reporting Updates

### **Filter Options for Exports**
Add Tamkeen support as a filter option in export forms:

```html
<!-- Export filter form -->
<div class="export-filters">
  <!-- Existing filters -->
  <select name="status">
    <option value="">All Statuses</option>
    <option value="submitted">Submitted</option>
    <option value="approved">Approved</option>
  </select>
  
  <!-- ✅ NEW Tamkeen filter -->
  <select name="tamkeen_support">
    <option value="">All Courses</option>
    <option value="true">Tamkeen Supported Only</option>
    <option value="false">Non-Tamkeen Only</option>
  </select>
</div>
```

### **Manager Approval Page Updates**
When managers review applications, they'll see Tamkeen support information:

```html
<!-- Manager approval page -->
<div class="application-review">
  <h2>{{ application.applicant_name }}</h2>
  <div class="course-info">
    <h3>{{ application.course_title }}</h3>
    <p><strong>Category:</strong> {{ application.course_category }}</p>
    <p><strong>Price:</strong> ${{ application.course_price }}</p>
    
    <!-- ✅ NEW Tamkeen info for managers -->
    <p v-if="application.course_is_tamkeen_support" class="tamkeen-highlight">
      <strong>💰 Funding:</strong> This course is supported by Tamkeen
    </p>
  </div>
</div>
```