// Sample knowledge graph data representing a Spring Boot e-commerce thesis project
export const SAMPLE_GRAPH = {
  version: '1.0.0',
  project: {
    name: 'thesis-ecommerce',
    languages: ['java'],
    frameworks: ['spring-boot', 'spring-security', 'hibernate'],
    description: 'Hệ thống Quản lý Bán hàng Online — KLTN NEU 2025-2026',
    analyzedAt: '2026-06-05T14:32:00Z',
    gitCommitHash: 'a3f8b2c',
  },
  nodes: [
    // Controllers
    { id: 'AuthController', name: 'AuthController', type: 'class', filePath: 'src/main/java/com/neu/controller/AuthController.java', summary: 'Xử lý các HTTP request liên quan đến xác thực: đăng nhập, đăng ký, refresh token.', tags: ['controller', 'auth', 'rest'], complexity: 'moderate', languageNotes: 'Sử dụng @RestController và @RequestMapping để định nghĩa REST endpoints.' },
    { id: 'ProductController', name: 'ProductController', type: 'class', filePath: 'src/main/java/com/neu/controller/ProductController.java', summary: 'CRUD operations cho sản phẩm: thêm, sửa, xóa, tìm kiếm sản phẩm.', tags: ['controller', 'product', 'rest'], complexity: 'moderate' },
    { id: 'OrderController', name: 'OrderController', type: 'class', filePath: 'src/main/java/com/neu/controller/OrderController.java', summary: 'Quản lý đơn hàng: tạo, cập nhật trạng thái, lịch sử đơn hàng.', tags: ['controller', 'order', 'rest'], complexity: 'complex' },
    { id: 'UserController', name: 'UserController', type: 'class', filePath: 'src/main/java/com/neu/controller/UserController.java', summary: 'Quản lý người dùng: profile, địa chỉ giao hàng, lịch sử mua.', tags: ['controller', 'user', 'rest'], complexity: 'simple' },
    { id: 'CartController', name: 'CartController', type: 'class', filePath: 'src/main/java/com/neu/controller/CartController.java', summary: 'Quản lý giỏ hàng: thêm/xóa sản phẩm, cập nhật số lượng.', tags: ['controller', 'cart'], complexity: 'moderate' },

    // Services
    { id: 'AuthService', name: 'AuthService', type: 'service', filePath: 'src/main/java/com/neu/service/AuthService.java', summary: 'Business logic cho xác thực: validate credentials, generate JWT, refresh token.', tags: ['service', 'auth', 'jwt'], complexity: 'complex', languageNotes: 'Implement interface để hỗ trợ dependency injection và unit testing dễ dàng.' },
    { id: 'ProductService', name: 'ProductService', type: 'service', filePath: 'src/main/java/com/neu/service/ProductService.java', summary: 'Business logic cho sản phẩm: validation, pricing, inventory management.', tags: ['service', 'product', 'inventory'], complexity: 'complex' },
    { id: 'OrderService', name: 'OrderService', type: 'service', filePath: 'src/main/java/com/neu/service/OrderService.java', summary: 'Xử lý luồng đặt hàng, tính toán giá, quản lý trạng thái đơn hàng.', tags: ['service', 'order', 'payment'], complexity: 'complex' },
    { id: 'UserService', name: 'UserService', type: 'service', filePath: 'src/main/java/com/neu/service/UserService.java', summary: 'Quản lý thông tin người dùng, mã hóa mật khẩu, phân quyền.', tags: ['service', 'user', 'security'], complexity: 'moderate' },
    { id: 'EmailService', name: 'EmailService', type: 'service', filePath: 'src/main/java/com/neu/service/EmailService.java', summary: 'Gửi email thông báo: xác nhận đơn hàng, reset password, welcome email.', tags: ['service', 'email', 'notification'], complexity: 'simple' },
    { id: 'CartService', name: 'CartService', type: 'service', filePath: 'src/main/java/com/neu/service/CartService.java', summary: 'Quản lý session giỏ hàng, tính tổng tiền, áp dụng coupon.', tags: ['service', 'cart', 'session'], complexity: 'moderate' },

    // Repositories
    { id: 'UserRepository', name: 'UserRepository', type: 'class', filePath: 'src/main/java/com/neu/repository/UserRepository.java', summary: 'JPA Repository cho entity User. CRUD + custom queries như findByEmail, findByRole.', tags: ['repository', 'jpa', 'user'], complexity: 'simple' },
    { id: 'ProductRepository', name: 'ProductRepository', type: 'class', filePath: 'src/main/java/com/neu/repository/ProductRepository.java', summary: 'JPA Repository cho Product với full-text search và filter by category/price.', tags: ['repository', 'jpa', 'product'], complexity: 'moderate' },
    { id: 'OrderRepository', name: 'OrderRepository', type: 'class', filePath: 'src/main/java/com/neu/repository/OrderRepository.java', summary: 'Repository cho Order entity với queries theo user, status, và date range.', tags: ['repository', 'jpa', 'order'], complexity: 'moderate' },
    { id: 'CartRepository', name: 'CartRepository', type: 'class', filePath: 'src/main/java/com/neu/repository/CartRepository.java', summary: 'Repository cho Cart với findByUserId và cleanup expired carts.', tags: ['repository', 'jpa', 'cart'], complexity: 'simple' },

    // Entities / Models
    { id: 'User', name: 'User', type: 'table', filePath: 'src/main/java/com/neu/entity/User.java', summary: 'Entity đại diện người dùng: id, email, password, role, createdAt.', tags: ['entity', 'user', 'jpa'], complexity: 'simple' },
    { id: 'Product', name: 'Product', type: 'table', filePath: 'src/main/java/com/neu/entity/Product.java', summary: 'Entity sản phẩm: name, price, stock, category, images, description.', tags: ['entity', 'product', 'jpa'], complexity: 'simple' },
    { id: 'Order', name: 'Order', type: 'table', filePath: 'src/main/java/com/neu/entity/Order.java', summary: 'Entity đơn hàng: items, totalAmount, status, shippingAddress, timestamps.', tags: ['entity', 'order', 'jpa'], complexity: 'moderate' },
    { id: 'Cart', name: 'Cart', type: 'table', filePath: 'src/main/java/com/neu/entity/Cart.java', summary: 'Entity giỏ hàng: userId, items, createdAt, expiresAt.', tags: ['entity', 'cart', 'jpa'], complexity: 'simple' },

    // Utilities / Config
    { id: 'JwtTokenProvider', name: 'JwtTokenProvider', type: 'class', filePath: 'src/main/java/com/neu/security/JwtTokenProvider.java', summary: 'Generate, validate và parse JWT tokens. Sử dụng HS256 algorithm.', tags: ['security', 'jwt', 'utils'], complexity: 'moderate', languageNotes: 'Dùng @Component để Spring quản lý, inject SECRET_KEY từ application.properties.' },
    { id: 'SecurityConfig', name: 'SecurityConfig', type: 'config', filePath: 'src/main/java/com/neu/config/SecurityConfig.java', summary: 'Cấu hình Spring Security: CORS, CSRF, authentication filters, authorization rules.', tags: ['config', 'security', 'spring'], complexity: 'complex' },
    { id: 'DatabaseConfig', name: 'DatabaseConfig', type: 'config', filePath: 'src/main/resources/application.properties', summary: 'Cấu hình kết nối MySQL, JPA/Hibernate, connection pool settings.', tags: ['config', 'database', 'mysql'], complexity: 'simple' },
    { id: 'CorsConfig', name: 'CorsConfig', type: 'config', filePath: 'src/main/java/com/neu/config/CorsConfig.java', summary: 'Cấu hình CORS cho phép frontend React kết nối.', tags: ['config', 'cors'], complexity: 'simple' },

    // Endpoints
    { id: 'POST_auth_login', name: 'POST /api/auth/login', type: 'endpoint', summary: 'Đăng nhập, trả về JWT access token và refresh token.', tags: ['auth', 'post', 'public'], complexity: 'moderate' },
    { id: 'GET_products', name: 'GET /api/products', type: 'endpoint', summary: 'Lấy danh sách sản phẩm có phân trang, filter và sort.', tags: ['product', 'get', 'public'], complexity: 'simple' },
    { id: 'POST_orders', name: 'POST /api/orders', type: 'endpoint', summary: 'Tạo đơn hàng mới từ giỏ hàng. Yêu cầu xác thực.', tags: ['order', 'post', 'auth-required'], complexity: 'complex' },
    { id: 'GET_users_profile', name: 'GET /api/users/profile', type: 'endpoint', summary: 'Lấy thông tin profile người dùng hiện tại.', tags: ['user', 'get', 'auth-required'], complexity: 'simple' },

    // DTOs
    { id: 'LoginRequest', name: 'LoginRequest', type: 'schema', filePath: 'src/main/java/com/neu/dto/LoginRequest.java', summary: 'DTO cho request đăng nhập: email, password.', tags: ['dto', 'auth'], complexity: 'simple' },
    { id: 'ProductDTO', name: 'ProductDTO', type: 'schema', filePath: 'src/main/java/com/neu/dto/ProductDTO.java', summary: 'DTO cho product response: loại trừ các field nhạy cảm.', tags: ['dto', 'product'], complexity: 'simple' },
    { id: 'OrderDTO', name: 'OrderDTO', type: 'schema', filePath: 'src/main/java/com/neu/dto/OrderDTO.java', summary: 'DTO cho order request/response với validation annotations.', tags: ['dto', 'order'], complexity: 'moderate' },

    // Main
    { id: 'MainApplication', name: 'NEUShopApplication', type: 'file', filePath: 'src/main/java/com/neu/NEUShopApplication.java', summary: 'Entry point của Spring Boot application. @SpringBootApplication.', tags: ['main', 'spring-boot'], complexity: 'simple' },
  ],
  edges: [
    // Controller → Service
    { source: 'AuthController', target: 'AuthService', type: 'calls', direction: 'forward', weight: 0.9 },
    { source: 'ProductController', target: 'ProductService', type: 'calls', direction: 'forward', weight: 0.9 },
    { source: 'OrderController', target: 'OrderService', type: 'calls', direction: 'forward', weight: 0.9 },
    { source: 'UserController', target: 'UserService', type: 'calls', direction: 'forward', weight: 0.9 },
    { source: 'CartController', target: 'CartService', type: 'calls', direction: 'forward', weight: 0.9 },

    // Service → Repository
    { source: 'AuthService', target: 'UserRepository', type: 'calls', direction: 'forward', weight: 0.8 },
    { source: 'ProductService', target: 'ProductRepository', type: 'calls', direction: 'forward', weight: 0.8 },
    { source: 'OrderService', target: 'OrderRepository', type: 'calls', direction: 'forward', weight: 0.8 },
    { source: 'OrderService', target: 'ProductService', type: 'calls', direction: 'forward', weight: 0.7 },
    { source: 'UserService', target: 'UserRepository', type: 'calls', direction: 'forward', weight: 0.8 },
    { source: 'CartService', target: 'CartRepository', type: 'calls', direction: 'forward', weight: 0.8 },
    { source: 'CartService', target: 'ProductService', type: 'calls', direction: 'forward', weight: 0.6 },

    // Repository → Entity
    { source: 'UserRepository', target: 'User', type: 'reads_from', direction: 'forward', weight: 0.9 },
    { source: 'ProductRepository', target: 'Product', type: 'reads_from', direction: 'forward', weight: 0.9 },
    { source: 'OrderRepository', target: 'Order', type: 'reads_from', direction: 'forward', weight: 0.9 },
    { source: 'CartRepository', target: 'Cart', type: 'reads_from', direction: 'forward', weight: 0.9 },

    // Security
    { source: 'AuthService', target: 'JwtTokenProvider', type: 'calls', direction: 'forward', weight: 0.85 },
    { source: 'SecurityConfig', target: 'JwtTokenProvider', type: 'configures', direction: 'forward', weight: 0.7 },
    { source: 'SecurityConfig', target: 'UserService', type: 'configures', direction: 'forward', weight: 0.6 },

    // Endpoints → Controllers
    { source: 'POST_auth_login', target: 'AuthController', type: 'routes', direction: 'forward', weight: 0.9 },
    { source: 'GET_products', target: 'ProductController', type: 'routes', direction: 'forward', weight: 0.9 },
    { source: 'POST_orders', target: 'OrderController', type: 'routes', direction: 'forward', weight: 0.9 },
    { source: 'GET_users_profile', target: 'UserController', type: 'routes', direction: 'forward', weight: 0.9 },

    // DTOs
    { source: 'AuthController', target: 'LoginRequest', type: 'validates', direction: 'forward', weight: 0.7 },
    { source: 'ProductController', target: 'ProductDTO', type: 'transforms', direction: 'forward', weight: 0.7 },
    { source: 'OrderController', target: 'OrderDTO', type: 'validates', direction: 'forward', weight: 0.7 },

    // Email
    { source: 'OrderService', target: 'EmailService', type: 'calls', direction: 'forward', weight: 0.5 },
    { source: 'UserService', target: 'EmailService', type: 'calls', direction: 'forward', weight: 0.4 },

    // Config
    { source: 'DatabaseConfig', target: 'UserRepository', type: 'configures', direction: 'forward', weight: 0.5 },
    { source: 'DatabaseConfig', target: 'ProductRepository', type: 'configures', direction: 'forward', weight: 0.5 },

    // Main
    { source: 'MainApplication', target: 'SecurityConfig', type: 'depends_on', direction: 'forward', weight: 0.6 },
    { source: 'MainApplication', target: 'DatabaseConfig', type: 'depends_on', direction: 'forward', weight: 0.6 },
  ],
  layers: [
    {
      id: 'layer-presentation',
      name: 'Presentation Layer (Controller)',
      description: 'Tầng giao tiếp với client: nhận HTTP requests, validate input, trả về responses. Không chứa business logic.',
      nodeIds: ['AuthController', 'ProductController', 'OrderController', 'UserController', 'CartController', 'POST_auth_login', 'GET_products', 'POST_orders', 'GET_users_profile'],
    },
    {
      id: 'layer-business',
      name: 'Business Logic Layer (Service)',
      description: 'Tầng xử lý nghiệp vụ: validation, tính toán, orchestrate các operations. Đây là trái tim của ứng dụng.',
      nodeIds: ['AuthService', 'ProductService', 'OrderService', 'UserService', 'EmailService', 'CartService'],
    },
    {
      id: 'layer-data',
      name: 'Data Access Layer (Repository)',
      description: 'Tầng giao tiếp với database qua JPA/Hibernate. Cung cấp CRUD và custom queries.',
      nodeIds: ['UserRepository', 'ProductRepository', 'OrderRepository', 'CartRepository'],
    },
    {
      id: 'layer-domain',
      name: 'Domain Model (Entity)',
      description: 'Các entity JPA đại diện cho bảng trong database. Định nghĩa cấu trúc dữ liệu core.',
      nodeIds: ['User', 'Product', 'Order', 'Cart'],
    },
    {
      id: 'layer-config',
      name: 'Infrastructure & Config',
      description: 'Cấu hình hệ thống: Spring Security, Database, CORS, JWT. Tầng nền tảng của ứng dụng.',
      nodeIds: ['JwtTokenProvider', 'SecurityConfig', 'DatabaseConfig', 'CorsConfig', 'MainApplication'],
    },
    {
      id: 'layer-dto',
      name: 'Data Transfer Objects',
      description: 'DTOs để transfer data giữa các tầng, tránh expose trực tiếp entity ra ngoài.',
      nodeIds: ['LoginRequest', 'ProductDTO', 'OrderDTO'],
    },
  ],
  tour: [
    {
      order: 1,
      title: 'Entry Point & Cấu hình',
      description: 'Bắt đầu từ NEUShopApplication.java — entry point của Spring Boot. Từ đây Spring tự động scan và khởi tạo tất cả beans. SecurityConfig và DatabaseConfig được load đầu tiên để thiết lập nền tảng bảo mật và kết nối database.',
      nodeIds: ['MainApplication', 'SecurityConfig', 'DatabaseConfig', 'CorsConfig'],
      languageLesson: '@SpringBootApplication kết hợp 3 annotation: @Configuration, @EnableAutoConfiguration, @ComponentScan. Spring Boot tự động cấu hình dựa trên dependencies trong classpath.',
    },
    {
      order: 2,
      title: 'Domain Model — Các Entity',
      description: 'Tiếp theo, hiểu cấu trúc dữ liệu qua các JPA entities. User, Product, Order, Cart là các class ánh xạ đến bảng database. Mỗi @Entity cần @Id để định nghĩa primary key.',
      nodeIds: ['User', 'Product', 'Order', 'Cart'],
      languageLesson: 'JPA @Entity, @Table, @Column giúp ánh xạ Java class → database table. Hibernate (JPA implementation) tự động tạo SQL queries từ method names trong Repository.',
    },
    {
      order: 3,
      title: 'Data Access Layer — Repository',
      description: 'Repositories là cầu nối với database. Spring Data JPA tự động implement các interface Repository, cung cấp CRUD operations và cho phép định nghĩa custom queries bằng method name convention.',
      nodeIds: ['UserRepository', 'ProductRepository', 'OrderRepository', 'CartRepository'],
      languageLesson: 'JpaRepository<Entity, ID> cung cấp sẵn: save(), findById(), findAll(), delete(). Custom queries: findByEmail() → Spring tự parse thành SELECT * FROM users WHERE email = ?',
    },
    {
      order: 4,
      title: 'Business Logic — Service Layer',
      description: 'Service layer chứa toàn bộ business logic. AuthService xử lý authentication với JWT. OrderService orchestrate luồng đặt hàng phức tạp: validate → check stock → create order → send email.',
      nodeIds: ['AuthService', 'ProductService', 'OrderService', 'UserService', 'CartService', 'EmailService', 'JwtTokenProvider'],
      languageLesson: '@Service annotation để Spring quản lý bean. @Transactional đảm bảo database operations trong 1 method được thực hiện atomically — hoặc tất cả thành công, hoặc rollback.',
    },
    {
      order: 5,
      title: 'Presentation Layer — Controller & Endpoints',
      description: 'Controllers là lớp ngoài cùng, tiếp nhận HTTP requests. Mỗi endpoint được định nghĩa bằng @GetMapping, @PostMapping. Validation input với @Valid trước khi chuyển xuống Service.',
      nodeIds: ['AuthController', 'ProductController', 'OrderController', 'POST_auth_login', 'GET_products', 'POST_orders', 'LoginRequest', 'ProductDTO', 'OrderDTO'],
      languageLesson: '@RestController = @Controller + @ResponseBody. ResponseEntity<T> cho phép control HTTP status code. DTOs tách biệt API contract khỏi internal domain model — best practice quan trọng.',
    },
  ],
}
